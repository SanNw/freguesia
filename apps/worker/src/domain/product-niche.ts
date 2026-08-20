import { telegramEnv as env } from "../config/runtime.js";

export type ProductNiche =
  | "hardware"
  | "home_kitchen"
  | "appliances"
  | "beauty"
  | "electronics"
  | "general";

const RULES: Array<{ niche: ProductNiche; terms: string[] }> = [
  {
    niche: "beauty",
    terms: [
      "perfume",
      "maquiagem",
      "batom",
      "base facial",
      "rimel",
      "mascara de cilios",
      "cosmetico",
      "shampoo",
      "condicionador",
      "hidratante",
      "protetor solar",
      "skincare",
      "serum facial",
      "creme facial",
      "desodorante",
      "barbeador",
      "secador de cabelo",
      "chapinha",
      "modelador de cachos",
      "escova secadora",
    ],
  },
  {
    niche: "appliances",
    terms: [
      "geladeira",
      "refrigerador",
      "freezer",
      "fogao",
      "cooktop",
      "forno eletrico",
      "micro-ondas",
      "air fryer",
      "fritadeira",
      "maquina de lavar",
      "lavadora",
      "lava-loucas",
      "secadora de roupas",
      "aspirador",
      "robo aspirador",
      "liquidificador",
      "batedeira",
      "mixer",
      "processador de alimentos",
      "cafeteira",
      "sanduicheira",
      "torradeira",
      "purificador de agua",
      "ventilador",
      "climatizador",
      "ar-condicionado",
      "aquecedor",
    ],
  },
  {
    niche: "electronics",
    terms: [
      "celular",
      "smartphone",
      "iphone",
      "galaxy",
      "moto g",
      "tablet",
      "notebook",
      "laptop",
      "chromebook",
      "computador completo",
      "pc completo",
      "pc gamer",
      "desktop completo",
      "all in one",
      "mini pc",
      "macbook",
      "imac",
      "smart tv",
      "televisao",
      "soundbar",
      "caixa de som",
      "fone",
      "headphone",
      "smartwatch",
      "camera",
      "filmadora",
      "projetor",
      "video game",
      "console",
      "playstation",
      "xbox",
      "nintendo switch",
      "kindle",
      "carregador",
      "power bank",
    ],
  },
  {
    niche: "hardware",
    terms: [
      "processador",
      "cpu amd",
      "cpu intel",
      "placa-mae",
      "placa de video",
      "gpu",
      "memoria ram",
      "ssd",
      "hd interno",
      "disco rigido",
      "gabinete",
      "fonte atx",
      "water cooler",
      "cooler para cpu",
      "pasta termica",
      "monitor",
      "teclado",
      "mouse",
      "mousepad",
      "webcam",
      "headset gamer",
      "hub usb",
      "dock station",
      "adaptador usb",
      "roteador",
      "repetidor wifi",
      "switch de rede",
      "placa de rede",
      "impressora",
      "scanner",
      "nobreak",
      "estabilizador",
    ],
  },
  {
    niche: "home_kitchen",
    terms: [
      "panela",
      "frigideira",
      "assadeira",
      "talher",
      "faqueiro",
      "prato",
      "copo",
      "taca",
      "garrafa termica",
      "pote",
      "utensilio de cozinha",
      "faca de cozinha",
      "cama",
      "lencol",
      "edredom",
      "cobertor",
      "toalha",
      "travesseiro",
      "tapete",
      "cortina",
      "organizador",
      "guarda-roupa",
      "armario",
      "mesa",
      "cadeira",
      "sofa",
      "colchao",
      "estante",
      "decoracao",
      "luminaria",
      "varal",
      "lixeira",
    ],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const GENERAL_ONLY_TERMS = [
  "baralho",
  "tarot",
  "cartas de tarot",
  "cartas de taro",
  "oraculo",
  "oracle",
  "adivinhacao",
];

export function classifyProductNiche(
  title: string,
  category?: string | null,
): ProductNiche {
  const text = normalize(title);
  if (GENERAL_ONLY_TERMS.some((term) => text.includes(term))) return "general";
  const titleMatch = RULES.find((rule) =>
    rule.terms.some((term) => text.includes(term)),
  )?.niche;
  if (titleMatch) return titleMatch;

  const categoryFallback: Record<string, ProductNiche> = {
    MLB1055: "electronics",
    MLB1648: "hardware",
    MLB1000: "electronics",
    MLB5726: "appliances",
    MLB1574: "home_kitchen",
    MLB1246: "beauty",
  };
  return categoryFallback[category ?? ""] ?? "general";
}

export function productNicheLabel(niche: ProductNiche): string {
  return {
    hardware: "Hardware e Informática",
    home_kitchen: "Casa e Cozinha",
    appliances: "Eletrodomésticos",
    beauty: "Cosméticos e Beleza",
    electronics: "Eletrônicos",
    general: "Ofertas Gerais",
  }[niche];
}

export function productNicheChannel(niche: ProductNiche): string {
  const configured = {
    hardware: env.TELEGRAM_CHANNEL_HARDWARE_ID,
    home_kitchen: env.TELEGRAM_CHANNEL_HOME_KITCHEN_ID,
    appliances: env.TELEGRAM_CHANNEL_APPLIANCES_ID,
    beauty: env.TELEGRAM_CHANNEL_BEAUTY_ID,
    electronics: env.TELEGRAM_CHANNEL_ELECTRONICS_ID,
    general: env.TELEGRAM_PUBLIC_CHANNEL_ID,
  }[niche];
  return configured || env.TELEGRAM_PUBLIC_CHANNEL_ID;
}
