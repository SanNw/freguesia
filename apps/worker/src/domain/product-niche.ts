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
    | "manual_history"
    | "conflict"
    | "unclassified";
  automatic: boolean;
  version?: string;
  matchedTerms?: string[];
}

export const PRODUCT_CLASSIFIER_VERSION = "2.0.0";

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
      "airfryer",
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
      "hidratacao capilar",
      "elastico de cabelo",
      "mascara capilar",
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
      "pen drive",
      "pendrive",
      "rtx",
      "gtx",
      "radeon",
      "ryzen",
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
      "tenis",
      "babuche",
      "sneakers",
      "running shoes",
      "regata",
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
      "arvore de natal",
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
    .toLowerCase()
    .replace(/[-–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERAL_ONLY_TERMS = [
  "baralho",
  "tarot",
  "cartas de tarot",
  "cartas de taro",
  "oraculo",
  "oracle",
  "adivinhacao",
  "creatina",
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
    terms: [
      "geladeira",
      "micro-ondas",
      "lava-loucas",
      "maquina de lavar",
      "liquidificador",
      "sorveteira",
    ],
  },
  { niche: "electronics", terms: ["power bank", "controle joystick"] },
  { niche: "beauty", terms: ["pente dentes largos", "modelador shark"] },
  {
    niche: "beauty",
    terms: ["secador shark", "perfume masculino", "perfume feminino"],
  },
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

export function classifyProductNiche(
  title: string,
  category?: string | null,
): ProductNiche {
  return classifyProductNicheDecision(title, category).niche;
}

function matchesTerm(text: string, term: string): boolean {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}s?(?=$|[^a-z0-9])`).test(text);
}

function matchingNiches(text: string): ProductNiche[] {
  return [
    ...new Set(
      [
        ...RULES,
        ...EXPLICIT_AUTOMATIC_RULES,
        { niche: "fashion" as const, terms: EXPLICIT_FASHION_TERMS },
      ]
        .filter((rule) => rule.terms.some((term) => matchesTerm(text, term)))
        .map((rule) => rule.niche),
    ),
  ];
}

function decideProductNiche(
  title: string,
  category?: string | null,
): ProductNicheDecision {
  let text = normalize(title);
  const normalizedCategory = normalize(category ?? "");
  const officialCategoryMatch = OFFICIAL_CATEGORY_ROOTS.find(({ roots }) =>
    roots.some(
      (root) =>
        normalizedCategory === normalize(root) ||
        normalizedCategory.startsWith(`${normalize(root)} >`) ||
        normalizedCategory.startsWith(`${normalize(root)}/`),
    ),
  )?.niche;
  if (
    GENERAL_ONLY_TERMS.some((term) => matchesTerm(text, term)) ||
    /\b(boneca|brinquedo|cachorro|gato|pet)\b/.test(text) ||
    /\bmonitor de pressao\b/.test(text)
  ) {
    return {
      niche: "general",
      confidence: "high",
      evidence: "explicit_general",
      automatic: true,
    };
  }

  // Accessory/usage context must not be mistaken for the principal object.
  if (/\b(suporte|base|capa) (?:para |de )?notebook\b/.test(text)) {
    return {
      niche: "hardware",
      confidence: "high",
      evidence: "title",
      automatic: true,
    };
  }
  if (/\b(mochila|bolsa)\b/.test(text)) {
    text = text.replace(/\bpara notebook\b/g, " ");
  }
  if (/\b(para costura|saco para lavar|aplique)\b/.test(text)) {
    return {
      niche: "general",
      confidence: "low",
      evidence: "conflict",
      automatic: false,
    };
  }
  if (/\b(capilar|cabelo|facial)\b/.test(text)) {
    text = text.replace(/\b(potes?|embalagem|frasco)\b/g, " ");
    if (matchesTerm(text, "elastico de cabelo"))
      text = text.replace(/\bbolsa\b/g, " ");
  }
  if (matchesTerm(text, "mousepad")) text = text.replace(/\btapetes?\b/g, " ");
  if (/\b(potes?|marmita|organizador)\b/.test(text)) {
    text = text.replace(/\b(?:para |de )?freezer\b/g, " ");
  }

  const titleMatches = matchingNiches(text);
  const primaryTitleMatch = TITLE_PRIMARY_RULES.find((rule) =>
    rule.terms.some((term) => matchesTerm(text, term)),
  )?.niche;
  if (
    primaryTitleMatch &&
    titleMatches.every(
      (niche) => niche === "hardware" || niche === "electronics",
    ) &&
    !matchesTerm(text, "mochila") &&
    !matchesTerm(text, "bolsa")
  ) {
    return {
      niche: primaryTitleMatch,
      confidence: "high",
      evidence: "title",
      automatic: true,
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
  if (titleMatches.length === 1) {
    const niche = titleMatches[0];
    const ambiguous = new Set([
      "monitor",
      "camera",
      "console",
      "gabinete",
      "pote",
      "cama",
      "mesa",
      "cadeira",
      "organizador",
      "espelho",
      "colar",
      "pulseira",
      "galaxy",
      "mixer",
      "lavadora",
      "aquecedor",
    ]);
    const strong = [
      ...RULES,
      ...EXPLICIT_AUTOMATIC_RULES,
      { niche: "fashion" as const, terms: EXPLICIT_FASHION_TERMS },
    ]
      .filter((rule) => rule.niche === niche)
      .some((rule) =>
        rule.terms.some(
          (term) => !ambiguous.has(normalize(term)) && matchesTerm(text, term),
        ),
      );
    if (
      strong ||
      officialCategoryMatch === niche ||
      (niche === "home_kitchen" &&
        /\b(pote|organizador)\b.*\bpara freezer\b/.test(normalize(title)))
    ) {
      return { niche, confidence: "high", evidence: "title", automatic: true };
    }
    if (!officialCategoryMatch) {
      return {
        niche,
        confidence: "medium",
        evidence: "title",
        automatic: false,
      };
    }
  }

  if (officialCategoryMatch) {
    return {
      niche: officialCategoryMatch,
      confidence: "high",
      evidence: "official_category",
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
  const categoryIdMatch =
    categoryFallback[(category ?? "").trim().toUpperCase()];
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

  if (categoryMatches.length === 1) {
    return {
      niche: categoryMatches[0],
      confidence: "medium",
      evidence: "category",
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

export function classifyProductNicheDecision(
  title: string,
  category?: string | null,
): ProductNicheDecision {
  const decision = decideProductNiche(title, category);
  const text = normalize(title);
  const matchedTerms = [
    ...new Set(
      [
        ...RULES,
        ...EXPLICIT_AUTOMATIC_RULES,
        { niche: "fashion" as const, terms: EXPLICIT_FASHION_TERMS },
      ].flatMap((rule) => rule.terms.filter((term) => matchesTerm(text, term))),
    ),
  ];
  return { ...decision, version: PRODUCT_CLASSIFIER_VERSION, matchedTerms };
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
