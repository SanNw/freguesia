import { telegramEnv as env } from "../config/runtime.js";

export type ProductNiche =
  | "hardware"
  | "home_kitchen"
  | "appliances"
  | "beauty"
  | "electronics"
  | "fashion"
  | "general";

export interface ProductNicheDecision {
  niche: ProductNiche;
  confidence: "high" | "medium" | "low";
  evidence:
    | "official_category"
    | "category"
    | "title"
    | "explicit_general"
    | "conflict"
    | "unclassified";
  automatic: boolean;
}

const RULES: Array<{ niche: ProductNiche; terms: string[] }> = [
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
      "triturador de alimentos",
      "processador alimentos",
      "processador univ",
      "processador 170ml",
      "processador 500ml",
      "cafeteira",
      "sanduicheira",
      "torradeira",
      "purificador de agua",
      "ventilador",
      "climatizador",
      "ar-condicionado",
      "aquecedor",
      "eletrodomesticos",
      "espremedor",
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
      "radios am/fm",
      "pilhas e carregadores",
    ],
  },
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
      "leave-in",
      "serum capilar",
      "cabelo humano",
      "extensao de cabelo",
      "gloss labial",
      "adesivo para acne",
      "adesivos para acne",
      "beleza e cuidado pessoal",
    ],
  },
  {
    niche: "hardware",
    terms: [
      "processador intel",
      "processador amd",
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
      "cabo de rede",
      "cabo hdmi",
      "perifericos",
      "impressora",
      "scanner",
      "nobreak",
      "estabilizador",
    ],
  },
  {
    niche: "fashion",
    terms: [
      "shorts",
      "bermuda",
      "camiseta",
      "camisa",
      "calca",
      "vestido",
      "saia",
      "blusa",
      "lingerie",
      "cueca",
      "jaqueta",
      "chinelo",
      "sandalia",
      "sapato",
      "tenis feminino",
      "tenis masculino",
      "bolsa feminina",
      "bolsa masculina",
      "mochila",
      "pulseira",
      "colar",
      "brinco",
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
      "jarra",
      "forma de gelo",
      "espelho",
      "tira manchas",
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

const TITLE_PRIMARY_RULES: Array<{ niche: ProductNiche; terms: string[] }> = [
  {
    niche: "electronics",
    terms: [
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
    ],
  },
];

const OFFICIAL_CATEGORY_ROOTS: Array<{
  roots: string[];
  niche: ProductNiche;
}> = [
  { roots: ["casa, moveis e decoracao"], niche: "home_kitchen" },
  { roots: ["eletrodomesticos"], niche: "appliances" },
  { roots: ["beleza e cuidado pessoal", "cuidados pessoais"], niche: "beauty" },
  {
    roots: ["eletronicos, audio e video", "celulares e telefones"],
    niche: "electronics",
  },
  {
    roots: ["computacao", "informatica", "perifericos"],
    niche: "hardware",
  },
  {
    roots: ["esportes e fitness", "livros", "automoveis, motos e outros"],
    niche: "general",
  },
  {
    roots: ["roupas e acessorios", "calcados", "calcados, roupas e bolsas"],
    niche: "fashion",
  },
];

const EXPLICIT_AUTOMATIC_RULES: Array<{
  niche: ProductNiche;
  terms: string[];
}> = [
  {
    niche: "appliances",
    terms: ["geladeira", "micro-ondas", "lava-loucas", "maquina de lavar", "liquidificador", "sorveteira"],
  },
  { niche: "electronics", terms: ["power bank", "controle joystick"] },
  { niche: "beauty", terms: ["pente dentes largos", "modelador shark"] },
  { niche: "beauty", terms: ["secador shark", "perfume masculino", "perfume feminino"] },
  { niche: "home_kitchen", terms: ["jogo de tacas", "mop shark"] },
  { niche: "hardware", terms: ["estabilizador", "switch wired"] },
];

const EXPLICIT_FASHION_TERMS = [
  "mochila",
  "tenis casual",
  "tenis nike",
  "bone ",
  "regata",
  "sacola nike",
  "bolsa de ombro",
  "meia nike",
  "vestido",
  "camiseta",
  "camisa feminina",
  "camisa masculina",
  "blusa feminina",
  "calca feminina",
  "calca masculina",
  "bermuda feminina",
  "bermuda masculina",
  "saia feminina",
  "tenis feminino",
  "tenis masculino",
  "sapato feminino",
  "sapato masculino",
  "bolsa feminina",
  "bolsa masculina",
  "calcinha",
  "sutiene",
  "sutia",
];

const FASHION_ADJACENT_BLOCKERS = [
  "boneca",
  "brinquedo",
  "cachorro",
  "gato",
  " pet ",
  "aplique",
  "para costura",
  "patch",
  "saco para lavar",
];

export function classifyProductNiche(
  title: string,
  category?: string | null,
): ProductNiche {
  return classifyProductNicheDecision(title, category).niche;
}

function matchingNiches(text: string): ProductNiche[] {
  return RULES.filter((rule) =>
    rule.terms.some((term) => text.includes(term)),
  ).map((rule) => rule.niche);
}

export function classifyProductNicheDecision(
  title: string,
  category?: string | null,
): ProductNicheDecision {
  const text = normalize(title);
  const normalizedCategory = normalize(category ?? "");
  const officialCategoryMatch = OFFICIAL_CATEGORY_ROOTS.find(({ roots }) =>
    roots.some(
      (root) =>
        normalizedCategory === root ||
        normalizedCategory.startsWith(`${root} >`) ||
        normalizedCategory.startsWith(`${root}/`),
    ),
  )?.niche;
  if (officialCategoryMatch) {
    return {
      niche: officialCategoryMatch,
      confidence: "high",
      evidence: "official_category",
      automatic: true,
    };
  }

  if (GENERAL_ONLY_TERMS.some((term) => text.includes(term))) {
    return {
      niche: "general",
      confidence: "high",
      evidence: "explicit_general",
      automatic: true,
    };
  }

  const categoryFallback: Record<string, ProductNiche> = {
    MLB1055: "electronics",
    MLB1648: "hardware",
    MLB1000: "electronics",
    MLB5726: "appliances",
    MLB1574: "home_kitchen",
    MLB1246: "beauty",
    MLB1430: "fashion",
  };
  const categoryIdMatch = categoryFallback[category ?? ""];
  if (categoryIdMatch) {
    return {
      niche: categoryIdMatch,
      confidence: "high",
      evidence: "official_category",
      automatic: true,
    };
  }

  const categoryMatches = normalizedCategory
    ? matchingNiches(normalizedCategory)
    : [];
  if (categoryMatches.length > 1) {
    return {
      niche: "general",
      confidence: "low",
      evidence: "conflict",
      automatic: false,
    };
  }

  if (
    EXPLICIT_FASHION_TERMS.some((term) => text.includes(term)) &&
    !FASHION_ADJACENT_BLOCKERS.some((term) => ` ${text} `.includes(term))
  ) {
    return {
      niche: "fashion",
      confidence: "high",
      evidence: "title",
      automatic: true,
    };
  }

  const explicitTitleMatch = EXPLICIT_AUTOMATIC_RULES.find((rule) =>
    rule.terms.some((term) => text.includes(term)),
  )?.niche;
  if (explicitTitleMatch) {
    return {
      niche: explicitTitleMatch,
      confidence: "high",
      evidence: "title",
      automatic: true,
    };
  }

  if (categoryMatches.length === 1) {
    return {
      niche: categoryMatches[0],
      confidence: "medium",
      evidence: "category",
      automatic: false,
    };
  }

  const primaryTitleMatch = TITLE_PRIMARY_RULES.find((rule) =>
    rule.terms.some((term) => text.includes(term)),
  )?.niche;
  if (primaryTitleMatch) {
    return {
      niche: primaryTitleMatch,
      confidence: "medium",
      evidence: "title",
      automatic: false,
    };
  }

  const titleMatches = matchingNiches(text);
  if (titleMatches.length === 1) {
    return {
      niche: titleMatches[0],
      confidence: "medium",
      evidence: "title",
      automatic: false,
    };
  }
  if (titleMatches.length > 1) {
    return {
      niche: "general",
      confidence: "low",
      evidence: "conflict",
      automatic: false,
    };
  }

  return {
    niche: "general",
    confidence: "low",
    evidence: "unclassified",
    automatic: false,
  };
}

export function productNicheLabel(niche: ProductNiche): string {
  return {
    hardware: "Hardware e Informática",
    home_kitchen: "Casa e Cozinha",
    appliances: "Eletrodomésticos",
    beauty: "Cosméticos e Beleza",
    electronics: "Eletrônicos",
    fashion: "Moda e Acessórios",
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
    fashion: env.TELEGRAM_CHANNEL_FASHION_ID,
    general: env.TELEGRAM_PUBLIC_CHANNEL_ID,
  }[niche];
  return configured || env.TELEGRAM_PUBLIC_CHANNEL_ID;
}
