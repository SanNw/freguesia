import base64
import hashlib
import os
import secrets
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse

import json

from bs4 import BeautifulSoup
from urllib.parse import urlparse

load_dotenv()

app = FastAPI(title="Freguesia")

CLIENT_ID = os.getenv("MERCADOLIVRE_CLIENT_ID")
CLIENT_SECRET = os.getenv("MERCADOLIVRE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("MERCADOLIVRE_REDIRECT_URI")

# Armazenamento temporário para desenvolvimento
oauth_sessions = {}
tokens = {}


def create_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip("=")


@app.get("/")
def inicio():
    return {
        "status": "Freguesia está funcionando",
        "conectar": "/connect/mercadolivre"
    }


@app.get("/connect/mercadolivre")
def conectar_mercado_livre():
    if not CLIENT_ID or not CLIENT_SECRET or not REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="As credenciais do Mercado Livre não foram configuradas."
        )

    state = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = create_code_challenge(code_verifier)

    oauth_sessions[state] = {
        "code_verifier": code_verifier
    }

    parameters = {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    authorization_url = (
        "https://auth.mercadolivre.com.br/authorization?"
        + urlencode(parameters)
    )

    return RedirectResponse(authorization_url)


@app.get("/produto-por-url")
async def buscar_produto_por_url(url: str):
    parsed_url = urlparse(url)
    hostname = (parsed_url.hostname or "").lower()

    dominios_permitidos = {
        "mercadolivre.com.br",
        "www.mercadolivre.com.br",
        "produto.mercadolivre.com.br",
    }

    if hostname not in dominios_permitidos:
        raise HTTPException(
            status_code=400,
            detail="Informe uma URL válida do Mercado Livre."
        )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0 Safari/537.36"
        ),
        "Accept-Language": "pt-BR,pt;q=0.9",
    }

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=20
    ) as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="Não foi possível acessar a página do produto."
        )

    soup = BeautifulSoup(response.text, "html.parser")

    def meta_content(*selectors):
        for selector in selectors:
            element = soup.select_one(selector)

            if element and element.get("content"):
                return element["content"].strip()

        return None

    titulo = meta_content(
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
    )

    imagem = meta_content(
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
    )

    preco = meta_content(
        'meta[property="product:price:amount"]',
        'meta[itemprop="price"]',
    )

    moeda = meta_content(
        'meta[property="product:price:currency"]',
        'meta[itemprop="priceCurrency"]',
    )

    # Alternativa: dados estruturados JSON-LD
    dados_estruturados = None

    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.get_text(strip=True))

            if isinstance(data, dict) and (
                data.get("@type") == "Product"
                or "offers" in data
            ):
                dados_estruturados = data
                break
        except (json.JSONDecodeError, TypeError):
            continue

    if dados_estruturados:
        titulo = titulo or dados_estruturados.get("name")

        json_image = dados_estruturados.get("image")

        if not imagem:
            if isinstance(json_image, list) and json_image:
                imagem = json_image[0]
            elif isinstance(json_image, str):
                imagem = json_image

        offers = dados_estruturados.get("offers") or {}

        if isinstance(offers, list) and offers:
            offers = offers[0]

        if isinstance(offers, dict):
            preco = preco or offers.get("price")
            moeda = moeda or offers.get("priceCurrency")

    if not titulo and not imagem:
        raise HTTPException(
            status_code=422,
            detail=(
                "O Mercado Livre não disponibilizou os dados "
                "públicos esperados nessa página."
            ),
        )

    return {
        "titulo": titulo,
        "preco": preco,
        "moeda": moeda or "BRL",
        "imagem": imagem,
        "link": str(response.url),
        "identificador": parsed_url.path.rstrip("/").split("/")[-1],
    }