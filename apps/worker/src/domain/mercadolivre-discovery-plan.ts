const FAMILIES: Record<string, string[]> = {
  MLB1055: [
    "smartphone",
    "iphone",
    "tablet",
    "carregador celular",
    "power bank",
    "smartwatch",
  ],
  MLB1648: [
    "ssd nvme",
    "placa de video",
    "memoria ram",
    "processador ryzen",
    "monitor gamer",
    "teclado mecanico",
    "mouse gamer",
    "roteador",
    "pen drive",
  ],
  MLB1000: [
    "smart tv",
    "fone bluetooth",
    "caixa de som",
    "soundbar",
    "console videogame",
    "projetor",
    "camera digital",
  ],
  MLB5726: [
    "air fryer",
    "geladeira",
    "maquina de lavar",
    "micro ondas",
    "liquidificador",
    "cafeteira",
    "aspirador",
    "ventilador",
    "lava loucas",
  ],
  MLB1574: [
    "jogo de panelas",
    "garrafa termica",
    "potes hermeticos",
    "jogo de cama",
    "toalha banho",
    "travesseiro",
    "organizador cozinha",
    "frigideira",
  ],
  MLB1246: [
    "perfume",
    "protetor solar",
    "shampoo",
    "secador cabelo",
    "hidratante",
    "maquiagem",
    "barbeador",
    "chapinha",
  ],
  MLB1430: [
    "tenis",
    "mochila",
    "camiseta",
    "calca",
    "vestido",
    "bolsa",
    "sandalia",
    "bermuda",
  ],
};

/** Two exploration cycles followed by one bestseller refresh, every 20 minutes. */
export function mercadoLivreDiscoveryQuery(
  category: string,
  cycle = Math.floor(Date.now() / 1_200_000),
): string | null {
  const families = FAMILIES[category];
  if (!families || cycle % 3 === 2) return null;
  const exploration = Math.floor(cycle / 3) * 2 + (cycle % 3);
  return families[exploration % families.length];
}
