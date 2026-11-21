import type { Coin, Pattern, MarketState } from "./types";
import { BASE_MS, pick, rand, recordPrice, stepCoin } from "./market";
import { scoreDescription } from "./hype";
import { applyShock } from "./market";

interface Profile {
  drift: number;
  vol: number;
  revert: number;
  eventRate: number;
  pumpBias: number;
  jumpP: number;
  jumpSize: number;
  waveAmp: number;
  beta: number;
  rug: [number, number];
}

// All values are "per second tick".
const PROFILES: Record<Pattern, Profile> = {
  stable:  { drift: 0,         vol: 0.00012, revert: 0.05,   eventRate: 0.000008, pumpBias: 0.5,  jumpP: 0.001,  jumpSize: 0.0008, waveAmp: 0,      beta: 0.02, rug: [4e-7,  2e-6]  },
  steady:  { drift: 0.000025,  vol: 0.0008,  revert: 0.0008, eventRate: 0.00012,  pumpBias: 0.55, jumpP: 0.004,  jumpSize: 0.004,  waveAmp: 0,      beta: 0.6,  rug: [2e-6,  8e-6]  },
  wave:    { drift: 0,         vol: 0.0012,  revert: 0.0008, eventRate: 0.0002,   pumpBias: 0.5,  jumpP: 0.006,  jumpSize: 0.006,  waveAmp: 0.0016, beta: 0.9,  rug: [4e-6,  1.6e-5]},
  moon:    { drift: 0.00014,   vol: 0.003,   revert: 0.0008, eventRate: 0.0006,   pumpBias: 0.7,  jumpP: 0.01,   jumpSize: 0.012,  waveAmp: 0.0004, beta: 1.2,  rug: [8e-6,  4e-5]  },
  crash:   { drift: -0.00015,  vol: 0.003,   revert: 0.0008, eventRate: 0.0006,   pumpBias: 0.3,  jumpP: 0.01,   jumpSize: 0.012,  waveAmp: 0.0004, beta: 1.2,  rug: [1.2e-5,5e-5]  },
  meme:    { drift: 0,         vol: 0.007,   revert: 0.0008, eventRate: 0.001,    pumpBias: 0.5,  jumpP: 0.012,  jumpSize: 0.03,   waveAmp: 0.0008, beta: 1.6,  rug: [2e-5,  8e-5]  },
  shady:   { drift: 0,         vol: 0.0045,  revert: 0.0008, eventRate: 0.0008,   pumpBias: 0.5,  jumpP: 0.01,   jumpSize: 0.02,   waveAmp: 0.001,  beta: 1.4,  rug: [5e-5,  1.2e-4]},
  launch:  { drift: 0,         vol: 0.005,   revert: 0.0005, eventRate: 0.0009,   pumpBias: 0.5,  jumpP: 0.01,   jumpSize: 0.02,   waveAmp: 0.001,  beta: 1.3,  rug: [1e-5,  1.2e-4]},
};

export interface CoinSeed {
  ticker: string;
  name: string;
  emoji: string;
  hue: number;
  price: number;
  supply: number;
  pattern: Pattern;
  description: string;
  over?: Partial<Coin>;
}

// ─── RLC Patch: 500 real Solana ecosystem coins ───────────────────────────
export const SEEDS: CoinSeed[] = [
  { ticker: "DRIFT", name: "Drift Protocol", emoji: "🌊", hue: 257, price: 7.2, supply: 1000000000, pattern: "steady", description: "Perpetuals and spot DEX on Solana with cross-margin accounts." },
  { ticker: "KMNO", name: "Kamino Finance", emoji: "🏦", hue: 339, price: 0.078, supply: 10000000000, pattern: "steady", description: "Automated liquidity strategies and lending on Solana." },
  { ticker: "MNDE", name: "Marinade Native", emoji: "🧂", hue: 82, price: 0.062, supply: 1000000000, pattern: "wave", description: "Governance token for Marinade liquid staking protocol." },
  { ticker: "BSOL", name: "BlazeStake SOL", emoji: "🔥", hue: 94, price: 194.0, supply: 20000000, pattern: "steady", description: "Liquid staked SOL from BlazeStake. Earns staking yield." },
  { ticker: "JSOL", name: "JPool SOL", emoji: "🌀", hue: 102, price: 193.5, supply: 18000000, pattern: "steady", description: "Liquid staking token from JPool. Diversified validator set." },
  { ticker: "FIDA", name: "Bonfida", emoji: "🔑", hue: 216, price: 0.31, supply: 126000000, pattern: "wave", description: "Solana Name Service and Serum ecosystem toolkit." },
  { ticker: "COPE", name: "Cope", emoji: "😤", hue: 145, price: 0.021, supply: 29000000, pattern: "crash", description: "Trading score aggregator that never really took off.", over: { drift: -7.3e-05 } },
  { ticker: "MAPS", name: "Maps.me", emoji: "🗺️", hue: 215, price: 0.0038, supply: 10000000000, pattern: "crash", description: "Travel super-app token. Mostly forgotten by the market.", over: { drift: -7.5e-05 } },
  { ticker: "OXY", name: "Oxygen", emoji: "💨", hue: 256, price: 0.012, supply: 980000000, pattern: "crash", description: "Prime brokerage on Solana. Volume dried up post-FTX.", over: { drift: -0.00012 } },
  { ticker: "SRM", name: "Serum", emoji: "🧪", hue: 302, price: 0.021, supply: 161000000, pattern: "crash", description: "FTX\'s DEX token. Effectively worthless after the collapse.", over: { drift: -0.000111 } },
  { ticker: "TULIP", name: "Tulip Protocol", emoji: "🌷", hue: 218, price: 0.68, supply: 10000000, pattern: "wave", description: "Yield aggregator on Solana. Strategies across lending protocols." },
  { ticker: "PORT", name: "Port Finance", emoji: "⚓", hue: 145, price: 0.019, supply: 100000000, pattern: "wave", description: "Variable and fixed rate lending on Solana." },
  { ticker: "SLND", name: "Solend", emoji: "🏊", hue: 95, price: 0.47, supply: 100000000, pattern: "wave", description: "Largest money market on Solana. Had governance drama in 2022." },
  { ticker: "UXD", name: "UXD Protocol", emoji: "🔄", hue: 241, price: 0.89, supply: 70000000, pattern: "wave", description: "Delta-neutral stablecoin backed by derivatives positions." },
  { ticker: "CATO", name: "CatoSwap", emoji: "🐈", hue: 145, price: 0.0003, supply: 999000000000, pattern: "meme", description: "Cat-themed DEX aggregator on Solana.", over: { vol: 0.0129 } },
  { ticker: "CRECK", name: "Creck", emoji: "💎", hue: 150, price: 0.00041, supply: 500000000000, pattern: "shady", description: "Community shard token, anonymous team, high rug risk.", over: { rugRisk: 0.0001431 } },
  { ticker: "DUST", name: "DeGods Dust", emoji: "✨", hue: 170, price: 0.44, supply: 500000000, pattern: "moon", description: "Utility token for DeGods NFT ecosystem on Solana.", over: { drift: 8.1e-05 } },
  { ticker: "FORGE", name: "Star Atlas Forge", emoji: "⚒️", hue: 71, price: 0.00018, supply: 36000000000, pattern: "moon", description: "In-game crafting token for Star Atlas metaverse game.", over: { drift: 9.6e-05 } },
  { ticker: "POLIS", name: "Star Atlas Polis", emoji: "🏛️", hue: 271, price: 0.045, supply: 360000000, pattern: "wave", description: "Governance token for Star Atlas DAO." },
  { ticker: "ATLAS", name: "Star Atlas", emoji: "🌌", hue: 283, price: 0.0038, supply: 36000000000, pattern: "wave", description: "In-game currency for Star Atlas space metaverse." },
  { ticker: "GENE", name: "Genopets", emoji: "🧬", hue: 197, price: 0.063, supply: 100000000, pattern: "moon", description: "Move-to-earn NFT game on Solana. Pet evolution mechanics.", over: { drift: 9e-05 } },
  { ticker: "NYAN", name: "Nyan Heroes", emoji: "🐱", hue: 40, price: 0.0071, supply: 500000000, pattern: "meme", description: "Play-to-earn shooter game with cat heroes on Solana." },
  { ticker: "POWER", name: "Meta Power", emoji: "⚡", hue: 277, price: 0.0014, supply: 1000000000, pattern: "moon", description: "GameFi token powering multiple Solana gaming ecosystems.", over: { drift: 6.8e-05 } },
  { ticker: "MCRT", name: "MagicCraft", emoji: "🔮", hue: 40, price: 0.0028, supply: 2000000000, pattern: "moon", description: "Fantasy RPG token on Solana with staking mechanics.", over: { drift: 7.4e-05 } },
  { ticker: "NINJA", name: "Ninja Protocol", emoji: "🥷", hue: 338, price: 0.0053, supply: 1000000000, pattern: "meme", description: "NFT gaming token with stealth-launch culture." },
  { ticker: "CWAR", name: "Cryowar", emoji: "❄️", hue: 181, price: 0.0012, supply: 1000000000, pattern: "moon", description: "Real-time arena PvP game on Solana blockchain.", over: { drift: 0.000153 } },
  { ticker: "TAO", name: "Bittensor SOL", emoji: "🧠", hue: 18, price: 420.0, supply: 7000000, pattern: "moon", description: "AI network token bridged to Solana. Huge AI narrative pump.", over: { drift: 0.000174 } },
  { ticker: "NMR", name: "Numerai SOL", emoji: "📊", hue: 27, price: 18.4, supply: 11000000, pattern: "steady", description: "Data science hedge fund token on Solana bridge." },
  { ticker: "OCEAN", name: "Ocean Protocol", emoji: "🌊", hue: 358, price: 0.72, supply: 613000000, pattern: "wave", description: "Decentralized data marketplace. AI data hype driver." },
  { ticker: "FETA", name: "Fetch.ai SOL", emoji: "🤖", hue: 108, price: 1.42, supply: 1150000000, pattern: "moon", description: "AI agent network token bridged to Solana ecosystem.", over: { drift: 0.000155 } },
  { ticker: "ALI", name: "Alethea AI", emoji: "🧞", hue: 94, price: 0.025, supply: 10000000000, pattern: "moon", description: "Intelligent NFT protocol with AI character generation.", over: { drift: 5.6e-05 } },
  { ticker: "CGPT", name: "ChainGPT", emoji: "💬", hue: 32, price: 0.17, supply: 1000000000, pattern: "moon", description: "AI-powered crypto toolkit. ChatGPT narrative plays on Solana.", over: { drift: 0.000175 } },
  { ticker: "AIBB", name: "AI BabyBot", emoji: "👶", hue: 240, price: 1.2e-05, supply: 420000000000, pattern: "meme", description: "ChatGPT meme coin on Solana. 100% vibes, launched in 2023.", over: { vol: 0.0106 } },
  { ticker: "USDT", name: "Tether SOL", emoji: "💲", hue: 230, price: 1.0002, supply: 90000000000, pattern: "stable", description: "USDT bridged to Solana. Dollar-backed, widely used." },
  { ticker: "WBTC", name: "Wrapped BTC SOL", emoji: "₿", hue: 34, price: 71200.0, supply: 500000, pattern: "steady", description: "Bitcoin bridged to Solana via Wormhole." },
  { ticker: "WETH", name: "Wrapped ETH SOL", emoji: "Ξ", hue: 42, price: 3850.0, supply: 2000000, pattern: "steady", description: "Ethereum bridged to Solana. Tracks ETH price closely." },
  { ticker: "JSB", name: "JitoSOL Bridge", emoji: "🌉", hue: 313, price: 196.0, supply: 15000000, pattern: "steady", description: "JitoSOL representation on Solana cross-chain." },
  { ticker: "MYRO", name: "Myro", emoji: "🐕", hue: 297, price: 0.17, supply: 1000000000, pattern: "meme", description: "Dog coin named after Raj Gokal\'s dog. Solana insider meme." },
  { ticker: "GECKO", name: "GeckoSOL", emoji: "🦎", hue: 121, price: 8.9e-05, supply: 100000000000, pattern: "meme", description: "Lizard meme coin, no utility, 100% community energy.", over: { vol: 0.008 } },
  { ticker: "WHALES", name: "WhaleSOL", emoji: "🐋", hue: 242, price: 0.0015, supply: 50000000000, pattern: "meme", description: "Whale-themed memecoin, pumped on whale-watcher narrative." },
  { ticker: "FROG", name: "Frog Nation", emoji: "🐸", hue: 212, price: 3.4e-05, supply: 420000000000, pattern: "meme", description: "Frog meme collective. Pepe derivatives meet Solana speed.", over: { vol: 0.0097 } },
  { ticker: "CATDOG", name: "CatDog", emoji: "🐱🐶", hue: 254, price: 2.1e-05, supply: 696000000000, pattern: "meme", description: "Half cat half dog. No sense, pure chaos, Solana native.", over: { vol: 0.0109 } },
  { ticker: "HARAMBE", name: "Harambe Token", emoji: "🦍", hue: 136, price: 0.0028, supply: 420000000, pattern: "meme", description: "RIP Harambe memecoin. Dipped in 2023, pumped in 2024." },
  { ticker: "SHIB2", name: "Shib Two SOL", emoji: "🔥", hue: 284, price: 3e-07, supply: 1000000000000000, pattern: "meme", description: "SHIB derivative on Solana. Supply is astronomically large.", over: { vol: 0.0126 } },
  { ticker: "PEPE2", name: "Pepe Two SOL", emoji: "🐸", hue: 168, price: 8.1e-08, supply: 420000000000000, pattern: "meme", description: "PEPE derivative launched on Solana. Extreme volatility.", over: { vol: 0.0144 } },
  { ticker: "DOGE2", name: "Doge Two SOL", emoji: "🐕", hue: 337, price: 6.1e-05, supply: 136000000000, pattern: "meme", description: "Dogecoin derivative. Runs on Elon tweets like clockwork.", over: { vol: 0.0099 } },
  { ticker: "FLOKI2", name: "Floki SOL", emoji: "⚡", hue: 3, price: 1.9e-05, supply: 10000000000000, pattern: "meme", description: "Viking dog coin on Solana. Marketing-heavy meme.", over: { vol: 0.0179 } },
  { ticker: "BABYBONK", name: "Baby Bonk", emoji: "🐣", hue: 344, price: 3.1e-06, supply: 420000000000000, pattern: "meme", description: "Baby version of BONK. Launched by BONK community.", over: { vol: 0.0073 } },
  { ticker: "BABYWIF", name: "Baby Wif", emoji: "🐾", hue: 126, price: 8.9e-05, supply: 100000000000, pattern: "meme", description: "Smaller cousin of WIF. Dog derivative on Solana.", over: { vol: 0.0114 } },
  { ticker: "WIFHAT", name: "Wif Hat", emoji: "🎩", hue: 271, price: 0.42, supply: 100000000, pattern: "meme", description: "WIF spinoff focusing on the hat. Absurdist Solana culture." },
  { ticker: "ANSEM", name: "Ansem SOL", emoji: "📢", hue: 102, price: 0.0071, supply: 1000000000, pattern: "meme", description: "Named after popular Solana CT influencer. Pure CT hype." },
  { ticker: "TATE", name: "Andrew Tate SOL", emoji: "🥊", hue: 62, price: 0.0019, supply: 10000000000, pattern: "shady", description: "Controversial figure memecoin. High rug risk, degenerate play.", over: { rugRisk: 7.27e-05 } },
  { ticker: "BARRON", name: "Barron Trump SOL", emoji: "🏌️", hue: 62, price: 0.0031, supply: 1000000000, pattern: "meme", description: "Trump\'s son memecoin. Political narrative meets Solana." },
  { ticker: "HAWK", name: "Hawk Tuah SOL", emoji: "🦅", hue: 149, price: 0.0082, supply: 1000000000, pattern: "meme", description: "Viral interview girl turned memecoin. Rugged in December 2024." },
  { ticker: "BUTTHOLE", name: "Butthole Coin", emoji: "🍑", hue: 75, price: 1.2e-06, supply: 1000000000000, pattern: "shady", description: "Explicit meme coin. Anonymous, high rug risk, community-run.", over: { rugRisk: 0.0001075 } },
  { ticker: "LIGMA", name: "Ligma SOL", emoji: "😂", hue: 302, price: 3.8e-05, supply: 69000000000, pattern: "meme", description: "Internet joke turned Solana memecoin. Pure degen culture.", over: { vol: 0.0097 } },
  { ticker: "NPC", name: "NPC Token", emoji: "🤖", hue: 105, price: 0.0051, supply: 1000000000, pattern: "meme", description: "NPC viral meme. TikTok NPC livestream culture on chain." },
  { ticker: "SIGMA", name: "Sigma Male SOL", emoji: "😎", hue: 69, price: 7.1e-05, supply: 100000000000, pattern: "meme", description: "Sigma grindset meme meets crypto. Ironic self-improvement coin.", over: { vol: 0.0121 } },
  { ticker: "GIGACHAD", name: "GigaChad SOL", emoji: "💪", hue: 132, price: 1.5e-05, supply: 500000000000, pattern: "meme", description: "GigaChad meme coin. Pumped by fitness culture CT.", over: { vol: 0.0158 } },
  { ticker: "DOOMER", name: "Doomer SOL", emoji: "😔", hue: 94, price: 9e-05, supply: 100000000000, pattern: "crash", description: "Ironic doomer meme coin. Designed to crash slowly.", over: { drift: -7.1e-05 } },
  { ticker: "WOJAK", name: "Wojak Finance", emoji: "😭", hue: 20, price: 3e-05, supply: 420000000000, pattern: "crash", description: "Wojak crying meme coin. For when you\'re down bad on SOL.", over: { drift: -5.2e-05 } },
  { ticker: "COOMER", name: "Coomer SOL", emoji: "🤤", hue: 303, price: 8.1e-06, supply: 1000000000000, pattern: "shady", description: "NSFW adjacent meme. Degenerate launch, anonymous team.", over: { rugRisk: 0.0001199 } },
  { ticker: "SAFU", name: "SAFU SOL", emoji: "🛡️", hue: 93, price: 0.019, supply: 1000000000, pattern: "wave", description: "Funds are SAFU meme coin. CZ Binance meme on Solana." },
  { ticker: "NGMI", name: "NGMI Token", emoji: "📉", hue: 29, price: 4.1e-06, supply: 1000000000000, pattern: "crash", description: "You\'re not gonna make it token. Ironic loss coin.", over: { drift: -0.000197 } },
  { ticker: "WAGMI", name: "WAGMI Token", emoji: "🤝", hue: 193, price: 0.0038, supply: 1000000000, pattern: "moon", description: "We\'re all gonna make it. Community optimism coin.", over: { drift: 7e-05 } },
  { ticker: "LFG", name: "LFG Token", emoji: "🚀", hue: 37, price: 0.0071, supply: 500000000, pattern: "moon", description: "Let\'s f***ing go. Pure momentum and hype coin.", over: { drift: 0.000174 } },
  { ticker: "APE", name: "ApeCoin SOL", emoji: "🦍", hue: 214, price: 1.42, supply: 1000000000, pattern: "wave", description: "Yuga Labs APE bridged to Solana for DeFi use." },
  { ticker: "BLUR", name: "Blur SOL", emoji: "🌫️", hue: 39, price: 0.31, supply: 1470000000, pattern: "wave", description: "NFT marketplace token bridged to Solana." },
  { ticker: "LOOKS", name: "LooksRare SOL", emoji: "👀", hue: 212, price: 0.058, supply: 1000000000, pattern: "crash", description: "NFT marketplace token. Volume wash trading revealed, crashed.", over: { drift: -0.000106 } },
  { ticker: "X2Y2", name: "X2Y2 SOL", emoji: "✖️", hue: 187, price: 0.016, supply: 1000000000, pattern: "crash", description: "Another NFT marketplace token that failed to maintain momentum.", over: { drift: -0.000145 } },
  { ticker: "MAGIC", name: "Magic Eden", emoji: "🪄", hue: 293, price: 1.84, supply: 450000000, pattern: "steady", description: "Magic Eden\'s token. Largest NFT marketplace on Solana." },
  { ticker: "TENSOR", name: "Tensor", emoji: "🧮", hue: 265, price: 0.84, supply: 1000000000, pattern: "steady", description: "Professional NFT trading platform. Competes with Magic Eden." },
  { ticker: "MEAN", name: "Mean Finance", emoji: "📐", hue: 349, price: 0.019, supply: 100000000, pattern: "wave", description: "Dollar cost averaging and payment streaming on Solana." },
  { ticker: "SUNNY", name: "Sunny Aggregator", emoji: "☀️", hue: 23, price: 4.1e-05, supply: 10000000000, pattern: "wave", description: "Yield aggregator for Saber pools. Mostly dormant now." },
  { ticker: "SABER", name: "Saber", emoji: "⚔️", hue: 65, price: 0.0038, supply: 10000000000, pattern: "crash", description: "Stablecoin AMM on Solana. Volume collapsed after UST.", over: { drift: -0.000147 } },
  { ticker: "MERCURIAL", name: "Mercurial Finance", emoji: "☿", hue: 286, price: 0.0019, supply: 10000000000, pattern: "crash", description: "Stable swap AMM rebranded to Meteora. Token still active.", over: { drift: -0.000137 } },
  { ticker: "LARIX", name: "Larix", emoji: "🌿", hue: 324, price: 0.0071, supply: 1000000000, pattern: "wave", description: "Lending and borrowing protocol on Solana." },
  { ticker: "FRANCIUM", name: "Francium", emoji: "⚗️", hue: 207, price: 0.0038, supply: 100000000, pattern: "wave", description: "Leveraged yield farming on Solana." },
  { ticker: "NINJA2", name: "NinjaSOL", emoji: "🥷", hue: 88, price: 1.9e-05, supply: 100000000000, pattern: "meme", description: "Second wave ninja meme. Post-WIF meme derivative.", over: { vol: 0.0098 } },
  { ticker: "SENSEI", name: "Sensei SOL", emoji: "🎌", hue: 155, price: 5.1e-05, supply: 500000000000, pattern: "meme", description: "Japanese culture meme coin on Solana.", over: { vol: 0.0159 } },
  { ticker: "ANIME", name: "Anime SOL", emoji: "🎌", hue: 92, price: 0.0028, supply: 10000000000, pattern: "moon", description: "Anime culture coin. Big community on Solana CT.", over: { drift: 5.3e-05 } },
  { ticker: "WEEB", name: "Weeb Finance", emoji: "🎏", hue: 291, price: 1.1e-05, supply: 1000000000000, pattern: "meme", description: "Anime meme coin derivative. Ironic weeb culture on chain.", over: { vol: 0.0077 } },
  { ticker: "KATANA", name: "Katana SOL", emoji: "⚔️", hue: 342, price: 0.0051, supply: 500000000, pattern: "moon", description: "Yield options protocol with samurai theme.", over: { drift: 0.000185 } },
  { ticker: "SHOGUN", name: "Shogun Finance", emoji: "🏯", hue: 198, price: 0.0071, supply: 200000000, pattern: "wave", description: "Japanese-themed DeFi with governance model." },
  { ticker: "RAMEN", name: "Ramen Finance", emoji: "🍜", hue: 71, price: 8.9e-05, supply: 69000000000, pattern: "meme", description: "Food meme coin. Ramen eating DeFi degen culture.", over: { vol: 0.0119 } },
  { ticker: "SUSHI2", name: "Sushi SOL", emoji: "🍣", hue: 176, price: 0.84, supply: 250000000, pattern: "wave", description: "SushiSwap bridged to Solana. DEX aggregation." },
  { ticker: "CAKE2", name: "PancakeSwap SOL", emoji: "🥞", hue: 266, price: 2.41, supply: 380000000, pattern: "wave", description: "PancakeSwap token on Solana. BSC crossover play." },
  { ticker: "PIZZA", name: "Pizza DAO", emoji: "🍕", hue: 8, price: 3.1e-05, supply: 420000000000, pattern: "meme", description: "Bitcoin Pizza Day meme coin. Community pizza fund.", over: { vol: 0.0084 } },
  { ticker: "BURGER", name: "BurgerSwap SOL", emoji: "🍔", hue: 245, price: 1.9e-05, supply: 100000000000, pattern: "meme", description: "Burger-themed DEX meme coin. Food DeFi trend.", over: { vol: 0.017 } },
  { ticker: "TENDIES", name: "Tendies SOL", emoji: "🍗", hue: 224, price: 4.1e-05, supply: 69000000000, pattern: "meme", description: "Chicken tenders meme. Classic 4chan /biz/ reference.", over: { vol: 0.0161 } },
  { ticker: "DUKO", name: "Duko", emoji: "🐕", hue: 277, price: 0.0038, supply: 999000000, pattern: "meme", description: "Duko dog meme coin. Part of the Solana dog coin wave." },
  { ticker: "CHIHUAHUA", name: "Chihuahua SOL", emoji: "🐕", hue: 236, price: 1.9e-05, supply: 100000000000, pattern: "meme", description: "Tiny dog, tiny price, big community on Solana.", over: { vol: 0.0106 } },
  { ticker: "PITBULL", name: "Pitbull SOL", emoji: "🐕", hue: 150, price: 5.1e-05, supply: 500000000000, pattern: "meme", description: "Aggressive dog meme. Community runs pump campaigns.", over: { vol: 0.0075 } },
  { ticker: "CORGI", name: "CorgiSOL", emoji: "🐕", hue: 72, price: 0.00028, supply: 10000000000, pattern: "meme", description: "Corgi butt meme coin. Beloved Solana dog variant.", over: { vol: 0.0121 } },
  { ticker: "SHIB3", name: "Shiba Inu 3", emoji: "🐕", hue: 285, price: 4.1e-09, supply: 1000000000000000000, pattern: "meme", description: "Third gen Shiba. Supply exceeds comprehension.", over: { vol: 0.0088 } },
  { ticker: "CATCOIN", name: "CatCoin SOL", emoji: "🐱", hue: 183, price: 1.9e-05, supply: 500000000000, pattern: "meme", description: "Generic cat coin. Part of cat vs dog memecoin wars.", over: { vol: 0.0133 } },
  { ticker: "LION", name: "Lion SOL", emoji: "🦁", hue: 36, price: 0.0071, supply: 1000000000, pattern: "moon", description: "King of memes. Solana lion pride community.", over: { drift: 0.000173 } },
  { ticker: "TIGER", name: "Tiger SOL", emoji: "🐯", hue: 319, price: 0.00028, supply: 10000000000, pattern: "meme", description: "Tiger meme coin. Asian market appeal on Solana.", over: { vol: 0.0113 } },
  { ticker: "PANDA", name: "Panda SOL", emoji: "🐼", hue: 26, price: 0.00051, supply: 5000000000, pattern: "meme", description: "Panda meme. WWF parody turned crypto community.", over: { vol: 0.0073 } },
  { ticker: "BEAR2", name: "Bear Market SOL", emoji: "🐻", hue: 302, price: 8.9e-05, supply: 100000000000, pattern: "crash", description: "Bearish sentiment coin. Pumps ironically in bull markets.", over: { drift: -0.000152 } },
  { ticker: "BULL2", name: "Bull Run SOL", emoji: "🐂", hue: 263, price: 0.0038, supply: 500000000, pattern: "moon", description: "Bull market memecoin. Surges during broad crypto rallies.", over: { drift: 7.6e-05 } },
  { ticker: "MAGA", name: "MAGA SOL", emoji: "🇺🇸", hue: 278, price: 0.0071, supply: 1000000000, pattern: "moon", description: "Political meme coin. Surged around 2024 US election season.", over: { drift: 8.2e-05 } },
  { ticker: "BIDEN", name: "Biden SOL", emoji: "👴", hue: 294, price: 0.0019, supply: 1000000000, pattern: "crash", description: "Political meme coin. Tanked after debate performance.", over: { drift: -7.8e-05 } },
  { ticker: "KAMALA", name: "Kamala SOL", emoji: "🏛️", hue: 183, price: 0.0028, supply: 1000000000, pattern: "crash", description: "Political meme. Lost election, coin followed.", over: { drift: -9.2e-05 } },
  { ticker: "ELON2", name: "Elon SOL", emoji: "🚀", hue: 52, price: 0.031, supply: 1000000000, pattern: "moon", description: "Elon Musk themed coin. Pumps on every Musk tweet.", over: { drift: 0.000183 } },
  { ticker: "JEFF", name: "Jeff Bezos SOL", emoji: "📦", hue: 43, price: 0.0051, supply: 1000000000, pattern: "wave", description: "Amazon founder themed meme. Blue Origin rocket vibes." },
  { ticker: "ZUCK", name: "Zuck SOL", emoji: "🤖", hue: 227, price: 0.0028, supply: 1000000000, pattern: "meme", description: "Meta CEO meme. Surged during Meta AI announcements." },
  { ticker: "SAM", name: "Sam Altman SOL", emoji: "🧠", hue: 135, price: 0.0071, supply: 1000000000, pattern: "moon", description: "OpenAI CEO meme. Pumps on every ChatGPT announcement.", over: { drift: 5.5e-05 } },
  { ticker: "JENSEN", name: "Jensen Huang SOL", emoji: "🎮", hue: 241, price: 0.019, supply: 500000000, pattern: "moon", description: "Nvidia CEO meme. Pumps on GPU shortage news.", over: { drift: 0.000143 } },
  { ticker: "HNT", name: "Helium SOL", emoji: "📡", hue: 54, price: 7.8, supply: 177000000, pattern: "wave", description: "Decentralized wireless network token. Migrated to Solana." },
  { ticker: "MOBILE", name: "Helium Mobile", emoji: "📱", hue: 50, price: 0.0038, supply: 100000000000, pattern: "wave", description: "Helium\'s 5G network token on Solana." },
  { ticker: "IOT", name: "Helium IoT", emoji: "📶", hue: 326, price: 7.1e-05, supply: 200000000000, pattern: "wave", description: "IoT network token from Helium ecosystem." },
  { ticker: "WEN", name: "Wen Token", emoji: "⏰", hue: 144, price: 5.1e-05, supply: 1000000000000, pattern: "meme", description: "Meme about crypto waiting culture. Airdropped to Solana users.", over: { vol: 0.0097 } },
  { ticker: "BERN", name: "BERNcoin", emoji: "🔥", hue: 55, price: 0.0038, supply: 100000000, pattern: "meme", description: "Deflationary burn meme coin on Solana." },
  { ticker: "PONKE", name: "Ponke", emoji: "🐒", hue: 81, price: 0.17, supply: 1000000000, pattern: "meme", description: "Monkey meme coin. Ponke the character has huge community." },
  { ticker: "SILLY", name: "Silly Dragon", emoji: "🐲", hue: 187, price: 0.11, supply: 1000000000, pattern: "meme", description: "Dragon meme. Silly character design went viral on Solana CT." },
  { ticker: "MOTHER", name: "Mother Iggy", emoji: "👩", hue: 163, price: 0.028, supply: 1000000000, pattern: "meme", description: "Iggy Azalea\'s memecoin. Celebrity launch, wild volatility." },
  { ticker: "COST", name: "CostCo SOL", emoji: "🏪", hue: 253, price: 8.9e-05, supply: 100000000000, pattern: "meme", description: "Costco wholesale meme coin. Retail culture on chain.", over: { vol: 0.0102 } },
  { ticker: "LUIGI", name: "Luigi SOL", emoji: "🍄", hue: 258, price: 0.0071, supply: 1000000000, pattern: "meme", description: "Nintendo character meme. Gaming culture x crypto." },
  { ticker: "MARIO", name: "Mario SOL", emoji: "🍄", hue: 76, price: 0.0051, supply: 1000000000, pattern: "meme", description: "Nintendo plumber meme on Solana. Mushroom kingdom vibes." },
  { ticker: "PIKACHU", name: "PikachuSOL", emoji: "⚡", hue: 97, price: 0.0028, supply: 1000000000, pattern: "meme", description: "Pokemon character meme. Nintendo IP risk adds to volatility." },
  { ticker: "SONIC2", name: "Sonic SOL", emoji: "💨", hue: 310, price: 0.0019, supply: 1000000000, pattern: "meme", description: "Sonic the Hedgehog meme. Gotta go fast — price included." },
  { ticker: "GOKU", name: "Goku SOL", emoji: "⚡", hue: 10, price: 0.0038, supply: 1000000000, pattern: "moon", description: "Dragonball Z meme coin. Anime CT runs this hard.", over: { drift: 0.000112 } },
  { ticker: "NARUTO", name: "Naruto SOL", emoji: "🍃", hue: 233, price: 0.0028, supply: 1000000000, pattern: "moon", description: "Naruto anime meme. Believe it — this pumps on JP news.", over: { drift: 0.000133 } },
  { ticker: "LUFFY", name: "Luffy SOL", emoji: "⚓", hue: 240, price: 0.0051, supply: 1000000000, pattern: "moon", description: "One Piece meme. Pirate crew on Solana.", over: { drift: 5.9e-05 } },
  { ticker: "MINION", name: "Minion SOL", emoji: "💛", hue: 158, price: 8.9e-05, supply: 100000000000, pattern: "meme", description: "Despicable Me minion meme coin. Banana loving community.", over: { vol: 0.0101 } },
  { ticker: "PYUSD", name: "PayPal USD SOL", emoji: "💙", hue: 45, price: 1.0003, supply: 50000000000, pattern: "stable", description: "PayPal\'s stablecoin on Solana. Major fintech bridge." },
  { ticker: "EURC", name: "EURC SOL", emoji: "🇪🇺", hue: 33, price: 1.082, supply: 2000000000, pattern: "stable", description: "Euro stablecoin from Circle on Solana." },
  { ticker: "FRAX", name: "Frax SOL", emoji: "🔷", hue: 155, price: 0.9997, supply: 5000000000, pattern: "stable", description: "Algorithmic stablecoin on Solana. Partially collateralized." },
  { ticker: "cUSDC", name: "cUSDC SOL", emoji: "💵", hue: 312, price: 1.0001, supply: 10000000000, pattern: "stable", description: "Compound\'s USDC wrapped on Solana." },
  { ticker: "WHSOL", name: "Wormhole SOL", emoji: "🕳️", hue: 7, price: 0.73, supply: 10000000000, pattern: "moon", description: "Wormhole bridge token on Solana. Cross-chain infrastructure.", over: { drift: 7.1e-05 } },
  { ticker: "ZETA", name: "Zeta Markets", emoji: "Ζ", hue: 128, price: 0.062, supply: 1000000000, pattern: "steady", description: "Options and perpetuals DEX on Solana." },
  { ticker: "DUAL", name: "Dual Finance", emoji: "⚖️", hue: 324, price: 0.019, supply: 100000000, pattern: "wave", description: "Options-based staking yield product on Solana." },
  { ticker: "HXRO", name: "Hxro Network", emoji: "🎲", hue: 141, price: 0.038, supply: 1000000000, pattern: "wave", description: "Parimutuel betting protocol. Gambling infrastructure on Solana." },
  { ticker: "CROWN", name: "Crowny", emoji: "👑", hue: 303, price: 0.0028, supply: 1000000000, pattern: "moon", description: "Loyalty program token with merchant network on Solana.", over: { drift: 8e-05 } },
  { ticker: "MEDIA", name: "Media Network", emoji: "📺", hue: 292, price: 1.84, supply: 20000000, pattern: "wave", description: "CDN and streaming protocol on Solana." },
  { ticker: "GRAPE", name: "Grape Protocol", emoji: "🍇", hue: 67, price: 0.0071, supply: 100000000, pattern: "wave", description: "DAO tooling and member verification on Solana." },
  { ticker: "NINJA3", name: "NinjaSC", emoji: "🥷", hue: 89, price: 1.9e-05, supply: 100000000000, pattern: "meme", description: "Third wave ninja. Ninja culture refuses to die on Solana.", over: { vol: 0.0167 } },
  { ticker: "CS", name: "Cyber Snake", emoji: "🐍", hue: 0, price: 1.8e-08, supply: 15330711889878, pattern: "meme", description: "The cyber snake meme coin on Solana. No utility. 100% community.", over: { vol: 0.0128 } },
  { ticker: "TH", name: "Turbo Hawk", emoji: "🦅", hue: 156, price: 3.53344e-05, supply: 3680732707, pattern: "meme", description: "The turbo hawk meme coin on Solana. No utility. 100% community.", over: { vol: 0.0139 } },
  { ticker: "GOLD", name: "GoldenVerse", emoji: "🎪", hue: 24, price: 0.0002010903, supply: 1506584696099, pattern: "meme", description: "GoldenVerse — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0158 } },
  { ticker: "BA", name: "Blessed Axolotl", emoji: "🦎", hue: 311, price: 2.51e-08, supply: 52158898860535296, pattern: "meme", description: "Launched on pump.fun in minutes. Based axolotl meme with extreme volatility.", over: { vol: 0.0157 } },
  { ticker: "CQ", name: "Chad Quokka", emoji: "🐾", hue: 358, price: 62.039965, supply: 2217822, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CS47", name: "Cracked Sloth", emoji: "🦥", hue: 227, price: 0.02911474, supply: 3683593394, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "ICEC", name: "IceChain", emoji: "👽", hue: 336, price: 8.1e-09, supply: 193681342209822, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0179 } },
  { ticker: "CB", name: "Cyber Bear", emoji: "🐻", hue: 343, price: 9.632609, supply: 2058769, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "CE", name: "Cracked Eagle", emoji: "🦅", hue: 346, price: 0.334037, supply: 603594353, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "DM", name: "Degen Mantis", emoji: "🦗", hue: 25, price: 0.020465, supply: 41344154153, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "SF", name: "Spicy Fox", emoji: "🦊", hue: 123, price: 0.045302, supply: 3532666033, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "CM", name: "Cooked Mantis", emoji: "🦗", hue: 354, price: 9.42e-08, supply: 20719929078531812, pattern: "meme", description: "Launched on pump.fun in minutes. Based mantis meme with extreme volatility.", over: { vol: 0.0156 } },
  { ticker: "NF", name: "Neon Fox", emoji: "🦊", hue: 328, price: 52.717787, supply: 124098, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "ROGU", name: "RogueLabs", emoji: "💥", hue: 347, price: 62.74059649, supply: 8029540, pattern: "moon", description: "RogueLabs aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000104 } },
  { ticker: "DC", name: "Drunk Croc", emoji: "🐊", hue: 15, price: 0.0005870244, supply: 514201206, pattern: "meme", description: "Launched on pump.fun in minutes. Based croc meme with extreme volatility.", over: { vol: 0.013 } },
  { ticker: "AF", name: "Ancient Flamingo", emoji: "🦩", hue: 285, price: 0.0691, supply: 12183208159, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "MYST", name: "MysticInu", emoji: "🍕", hue: 333, price: 0.0072878127, supply: 2866079184, pattern: "meme", description: "MysticInu — pure meme energy on Solana. No utility. 100% community." },
  { ticker: "NE", name: "Neon Echidna", emoji: "👽", hue: 327, price: 0.0182378334, supply: 58737887, pattern: "meme", description: "The neon echidna meme coin on Solana. No utility. 100% community." },
  { ticker: "ICED", name: "IceDAO", emoji: "🎰", hue: 337, price: 3.201e-07, supply: 583562066311188, pattern: "shady", description: "Anonymous team. No doxxing. High risk. IceDAO launched silently and the chart is unpredictable.", over: { rugRisk: 7.59e-05 } },
  { ticker: "CW", name: "Cracked Wolf", emoji: "🐺", hue: 4, price: 3.016639, supply: 13472720, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "AURA", name: "AuraNet", emoji: "🌑", hue: 27, price: 1.8433818332, supply: 33847743, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 0.0001336 } },
  { ticker: "SE", name: "Sacred Eagle", emoji: "🦅", hue: 122, price: 2.94017e-05, supply: 1153349688975, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Sacred Eagle launched silently and the chart is unpredictable.", over: { rugRisk: 7.77e-05 } },
  { ticker: "UE", name: "Ultra Eagle", emoji: "🦅", hue: 184, price: 0.1408575457, supply: 3536205740, pattern: "meme", description: "The ultra eagle meme coin on Solana. No utility. 100% community." },
  { ticker: "SH", name: "Sleepy Hawk", emoji: "🦅", hue: 125, price: 1.044e-05, supply: 101151962101308, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000108 } },
  { ticker: "CW13", name: "Cursed Whale", emoji: "🐋", hue: 14, price: 12.48936, supply: 267487, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "ATOM", name: "AtomicGate", emoji: "😤", hue: 65, price: 5.72e-06, supply: 942519148929, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -7.7e-05 } },
  { ticker: "AW", name: "Atomic Whale", emoji: "🐋", hue: 302, price: 1.09024e-05, supply: 598416384169, pattern: "meme", description: "Launched on pump.fun in minutes. Based whale meme with extreme volatility.", over: { vol: 0.0105 } },
  { ticker: "FIRE", name: "FireDAO", emoji: "🗑️", hue: 294, price: 4.28056327, supply: 5438319, pattern: "crash", description: "FireDAO has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -8.3e-05 } },
  { ticker: "PIXE", name: "PixelFi", emoji: "🤖", hue: 310, price: 0.0434772043, supply: 11941186, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "ROCK", name: "RockPad", emoji: "🩸", hue: 213, price: 1.04e-06, supply: 4593908608313, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000184 } },
  { ticker: "SHAD", name: "ShadowCore", emoji: "🌋", hue: 168, price: 0.00012122, supply: 15580269934, pattern: "moon", description: "ShadowCore aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000167 } },
  { ticker: "SHA7", name: "ShadowNetwork", emoji: "🐸", hue: 155, price: 0.0001809666, supply: 80385210492, pattern: "meme", description: "ShadowNetwork — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0076 } },
  { ticker: "BLES", name: "BlessedCash", emoji: "⚡", hue: 264, price: 6.252477, supply: 12824999, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CORE", name: "CoreSwap", emoji: "🚀", hue: 207, price: 0.21660604, supply: 29337856, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000199 } },
  { ticker: "DS", name: "Degen Snake", emoji: "🐍", hue: 31, price: 7.75612e-05, supply: 998424609335, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 8.05e-05 } },
  { ticker: "FIR80", name: "FireSOL", emoji: "🩸", hue: 119, price: 48.64864975, supply: 39552133, pattern: "crash", description: "FireSOL has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000165 } },
  { ticker: "QUAN", name: "QuantumProtocol", emoji: "📉", hue: 249, price: 5.88132559, supply: 660498, pattern: "crash", description: "QuantumProtocol has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.0002 } },
  { ticker: "FROS", name: "FrostNode", emoji: "🚀", hue: 224, price: 0.47319748, supply: 51323779, pattern: "moon", description: "FrostNode aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000196 } },
  { ticker: "NL", name: "Neon Lion", emoji: "🦁", hue: 334, price: 0.0010942143, supply: 1356049192, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Neon Lion launched silently and the chart is unpredictable.", over: { rugRisk: 4.57e-05 } },
  { ticker: "AF33", name: "Ancient Flamingo", emoji: "🦩", hue: 117, price: 0.1406139537, supply: 3098054337, pattern: "meme", description: "The ancient flamingo meme coin on Solana. No utility. 100% community." },
  { ticker: "SUNS", name: "SunSOL", emoji: "🍕", hue: 119, price: 0.0087111002, supply: 6312054457, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "BL", name: "Blessed Lemur", emoji: "🐒", hue: 322, price: 0.03355, supply: 34593930754, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "SPAR", name: "SparkCash", emoji: "💀", hue: 310, price: 2.1e-06, supply: 1762616416316, pattern: "crash", description: "SparkCash has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000149 } },
  { ticker: "SL", name: "Sacred Lion", emoji: "🦁", hue: 129, price: 0.0496194655, supply: 12794926321, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 5.69e-05 } },
  { ticker: "BASE", name: "BasedVerse", emoji: "🎊", hue: 193, price: 7.19840368, supply: 42649828, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "POCK", name: "PocketRocket", emoji: "🔵", hue: 31, price: 0.9991, supply: 21763346328, pattern: "stable", description: "Dollar-pegged stablecoin on Solana. Low volatility by design." },
  { ticker: "DE", name: "Drunk Eagle", emoji: "🦅", hue: 17, price: 5.20123216, supply: 1835150, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000172 } },
  { ticker: "NOVA", name: "NovaSOL", emoji: "💩", hue: 68, price: 5.47e-08, supply: 47192955058570, pattern: "meme", description: "NovaSOL — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0171 } },
  { ticker: "AM", name: "Angry Mantis", emoji: "🦗", hue: 292, price: 0.00097028, supply: 135460804, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "EDGE", name: "EdgeSOL", emoji: "🌊", hue: 277, price: 6.357267, supply: 482547, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "FLAS", name: "FlashCash", emoji: "🔥", hue: 144, price: 0.00060682, supply: 184266709297, pattern: "moon", description: "FlashCash aims for the stars. High drift, high risk, high reward.", over: { drift: 5.8e-05 } },
  { ticker: "AUR9", name: "AuraCoin", emoji: "🩸", hue: 19, price: 20.20022493, supply: 45175905, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000199 } },
  { ticker: "LF", name: "Lazy Flamingo", emoji: "🦩", hue: 266, price: 0.0010046994, supply: 2517017963, pattern: "meme", description: "Launched on pump.fun in minutes. Based flamingo meme with extreme volatility." },
  { ticker: "AS", name: "Alpha Shark", emoji: "🦈", hue: 298, price: 0.0001324181, supply: 42130259019, pattern: "meme", description: "The alpha shark meme coin on Solana. No utility. 100% community.", over: { vol: 0.0094 } },
  { ticker: "CN", name: "Cooked Numbat", emoji: "🌠", hue: 355, price: 0.01798529, supply: 443430043, pattern: "moon", description: "Cooked Numbat aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000177 } },
  { ticker: "WAVE", name: "WaveFi", emoji: "😭", hue: 217, price: 0.00929929, supply: 5673457614, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.00017 } },
  { ticker: "COR26", name: "CoreNet", emoji: "🔮", hue: 122, price: 0.049251, supply: 3208865, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "CULT", name: "CultCash", emoji: "💩", hue: 42, price: 0.0001517183, supply: 810194633149, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0109 } },
  { ticker: "BL55", name: "Baby Lion", emoji: "🦁", hue: 98, price: 4.84e-05, supply: 5938205864671, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000176 } },
  { ticker: "NJ", name: "Neon Jellyfish", emoji: "🪼", hue: 332, price: 58.322022, supply: 1274791, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "GANG", name: "GangCash", emoji: "🔑", hue: 315, price: 0.00473676, supply: 102108419, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "PEAK", name: "PeakMoon", emoji: "🩸", hue: 79, price: 0.06688326, supply: 22684772, pattern: "crash", description: "PeakMoon has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000177 } },
  { ticker: "BN", name: "Based Narwhal", emoji: "🦄", hue: 324, price: 5.3e-09, supply: 84033279894678, pattern: "meme", description: "Launched on pump.fun in minutes. Based narwhal meme with extreme volatility.", over: { vol: 0.0089 } },
  { ticker: "COSM", name: "CosmicRocket", emoji: "🎲", hue: 246, price: 9.505e-07, supply: 10617011388759, pattern: "meme", description: "CosmicRocket — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0135 } },
  { ticker: "CD", name: "Cooked Dog", emoji: "🐶", hue: 345, price: 137.460934, supply: 217711, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "AT", name: "Alpha Tardigrade", emoji: "🏦", hue: 299, price: 1.001, supply: 8469590494, pattern: "stable", description: "Dollar-pegged stablecoin on Solana. Low volatility by design." },
  { ticker: "SD", name: "Sleepy Dog", emoji: "🐶", hue: 121, price: 0.00038713, supply: 215353924862, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000171 } },
  { ticker: "BLAZ", name: "BlazeSwap", emoji: "🤡", hue: 147, price: 1.7e-09, supply: 2912353042334226, pattern: "meme", description: "BlazeSwap — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0147 } },
  { ticker: "SS", name: "Spicy Shark", emoji: "🦈", hue: 136, price: 0.166904, supply: 15328049, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "GWEI", name: "GweiNet", emoji: "🛸", hue: 300, price: 0.00058331, supply: 385817339, pattern: "moon", description: "GweiNet aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000187 } },
  { ticker: "CE9", name: "Chad Eagle", emoji: "🦅", hue: 343, price: 0.0107423042, supply: 5917235791, pattern: "meme", description: "The chad eagle meme coin on Solana. No utility. 100% community." },
  { ticker: "MB", name: "Mega Binturong", emoji: "🕵️", hue: 293, price: 5.516e-06, supply: 1973222552114, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Mega Binturong launched silently and the chart is unpredictable.", over: { rugRisk: 4.15e-05 } },
  { ticker: "AE", name: "Ancient Echidna", emoji: "🐶", hue: 284, price: 0.0002838143, supply: 4920596672775, pattern: "meme", description: "The ancient echidna meme coin on Solana. No utility. 100% community.", over: { vol: 0.0147 } },
  { ticker: "LL", name: "Lazy Lion", emoji: "🦁", hue: 272, price: 1.7e-09, supply: 1292077441402456, pattern: "meme", description: "Launched on pump.fun in minutes. Based lion meme with extreme volatility.", over: { vol: 0.0174 } },
  { ticker: "COS14", name: "CosmicHub", emoji: "🔥", hue: 330, price: 0.75919094, supply: 2610749, pattern: "moon", description: "CosmicHub aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000135 } },
  { ticker: "TURB", name: "TurboProtocol", emoji: "🤡", hue: 137, price: 7.1681e-06, supply: 547560862271, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0132 } },
  { ticker: "SL47", name: "Sleepy Lion", emoji: "🦁", hue: 356, price: 1.0005, supply: 25582846425, pattern: "stable", description: "Dollar-pegged stablecoin on Solana. Low volatility by design." },
  { ticker: "JOLL", name: "JollyDAO", emoji: "🌋", hue: 125, price: 0.01795215, supply: 19833200755, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 7.8e-05 } },
  { ticker: "TC", name: "Turbo Croc", emoji: "🐊", hue: 151, price: 0.00050938, supply: 19574161401, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000198 } },
  { ticker: "DS28", name: "Degen Shark", emoji: "🦈", hue: 77, price: 0.00304631, supply: 424040525, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000182 } },
  { ticker: "LAVA", name: "LavaCore", emoji: "👻", hue: 112, price: 0.0005914405, supply: 1121575071, pattern: "shady", description: "Anonymous team. No doxxing. High risk. LavaCore launched silently and the chart is unpredictable.", over: { rugRisk: 7.67e-05 } },
  { ticker: "SW", name: "Sacred Walrus", emoji: "🦭", hue: 140, price: 0.0025502436, supply: 3319177781, pattern: "meme", description: "The sacred walrus meme coin on Solana. No utility. 100% community." },
  { ticker: "SC", name: "Sacred Capybara", emoji: "🦫", hue: 120, price: 1.674314, supply: 11472927, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "HYPE", name: "HyperVault", emoji: "🏹", hue: 310, price: 0.00042218, supply: 2856255783, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "THPT", name: "Drunk Shark", emoji: "🦈", hue: 200, price: 0.0002350264, supply: 7015990371184, pattern: "meme", description: "The drunk shark meme coin on Solana. No utility. 100% community.", over: { vol: 0.0104 } },
  { ticker: "LC", name: "Lazy Cat", emoji: "🐱", hue: 263, price: 0.00083211, supply: 1863335173490, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000124 } },
  { ticker: "SL2", name: "Sleepy Lion", emoji: "🦁", hue: 89, price: 0.00014675, supply: 71172501476, pattern: "meme", description: "Launched on pump.fun in minutes. Based lion meme with extreme volatility.", over: { vol: 0.008 } },
  { ticker: "EDG9", name: "EdgeDAO", emoji: "🌙", hue: 265, price: 0.00638193, supply: 32634547, pattern: "moon", description: "EdgeDAO aims for the stars. High drift, high risk, high reward.", over: { drift: 8.5e-05 } },
  { ticker: "FLOW", name: "FlowFi", emoji: "☀️", hue: 222, price: 0.036025, supply: 5386295786, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "DC76", name: "Dank Capybara", emoji: "🦫", hue: 334, price: 0.8133572538, supply: 2530278, pattern: "meme", description: "The dank capybara meme coin on Solana. No utility. 100% community." },
  { ticker: "BLA28", name: "BlazingChain", emoji: "💩", hue: 133, price: 2.409e-07, supply: 927583306728, pattern: "meme", description: "BlazingChain — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0094 } },
  { ticker: "BT", name: "Baby Tardigrade", emoji: "🌊", hue: 330, price: 17.351391, supply: 605025, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "LUCK", name: "LuckyGem", emoji: "🌊", hue: 33, price: 16.98248, supply: 55432951, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "JOL19", name: "JollyInu", emoji: "💥", hue: 215, price: 3.161e-05, supply: 16361171521, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000129 } },
  { ticker: "DRIF", name: "DriftDAO", emoji: "🐱", hue: 203, price: 1.65303e-05, supply: 122920578786, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.007 } },
  { ticker: "ASTR", name: "AstroGem", emoji: "👻", hue: 344, price: 0.0023242541, supply: 287839850176, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 0.0001346 } },
  { ticker: "RM", name: "Royal Meerkat", emoji: "🦡", hue: 99, price: 0.3606421639, supply: 5522229448, pattern: "meme", description: "Launched on pump.fun in minutes. Based meerkat meme with extreme volatility." },
  { ticker: "VOID", name: "VoidDAO", emoji: "🤡", hue: 36, price: 0.0007304414, supply: 1192535068041, pattern: "meme", description: "VoidDAO — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0092 } },
  { ticker: "SB", name: "Sleepy Bull", emoji: "🐂", hue: 119, price: 0.00122396, supply: 2217186236, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "SS52", name: "Sleepy Sloth", emoji: "🦥", hue: 269, price: 0.0870702964, supply: 266754646, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 4.75e-05 } },
  { ticker: "NM", name: "Neon Mantis", emoji: "🦗", hue: 335, price: 12.311938, supply: 1751398, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "FUZZ", name: "FuzzyPump", emoji: "☯️", hue: 215, price: 37.253985, supply: 20152, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "ST", name: "Sleepy Tiger", emoji: "🐯", hue: 137, price: 1.2734271134, supply: 32643837, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Sleepy Tiger launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001032 } },
  { ticker: "BL12", name: "Baby Lemur", emoji: "🐒", hue: 331, price: 1.053e-07, supply: 3948959720756887, pattern: "meme", description: "The baby lemur meme coin on Solana. No utility. 100% community.", over: { vol: 0.0171 } },
  { ticker: "GP", name: "Golden Penguin", emoji: "🐧", hue: 121, price: 0.00017662, supply: 612289341081, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000177 } },
  { ticker: "COR19", name: "CoreDAO", emoji: "🤡", hue: 94, price: 2.8332e-06, supply: 325615696221632, pattern: "meme", description: "CoreDAO — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0106 } },
  { ticker: "CA", name: "Cursed Axolotl", emoji: "🦎", hue: 342, price: 0.0005093403, supply: 664048587633, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 4.12e-05 } },
  { ticker: "CLUB", name: "ClubPad", emoji: "🎪", hue: 294, price: 7.03437e-05, supply: 43367383196, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0135 } },
  { ticker: "AS50", name: "Atomic Snake", emoji: "🐍", hue: 69, price: 6.283e-05, supply: 3447251669969, pattern: "crash", description: "Atomic Snake has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000188 } },
  { ticker: "AP", name: "Alpha Platypus", emoji: "🦦", hue: 295, price: 0.02932922, supply: 4919511, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000166 } },
  { ticker: "GEMF", name: "GemFi", emoji: "🕶️", hue: 167, price: 0.4437741473, supply: 262330, pattern: "shady", description: "Anonymous team. No doxxing. High risk. GemFi launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001225 } },
  { ticker: "QUA34", name: "QuantumFi", emoji: "🌋", hue: 94, price: 0.00234384, supply: 40683217732, pattern: "moon", description: "QuantumFi aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000179 } },
  { ticker: "GWE92", name: "GweiCoin", emoji: "🃏", hue: 214, price: 0.3014508017, supply: 41635168, pattern: "shady", description: "Anonymous team. No doxxing. High risk. GweiCoin launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001424 } },
  { ticker: "PE", name: "Punk Eagle", emoji: "🦅", hue: 29, price: 6.5e-09, supply: 248282756461463104, pattern: "meme", description: "The punk eagle meme coin on Solana. No utility. 100% community.", over: { vol: 0.0111 } },
  { ticker: "DEGE", name: "DegenCoin", emoji: "🚀", hue: 247, price: 0.00186476, supply: 93486206, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000191 } },
  { ticker: "ST22", name: "Stoned Tardigrade", emoji: "⚡", hue: 57, price: 0.00016807, supply: 248858373002, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000109 } },
  { ticker: "CF", name: "Cooked Fox", emoji: "🦊", hue: 347, price: 1.41367e-05, supply: 87501623961, pattern: "meme", description: "Launched on pump.fun in minutes. Based fox meme with extreme volatility.", over: { vol: 0.0081 } },
  { ticker: "CUL70", name: "CultNet", emoji: "💩", hue: 91, price: 2.64e-08, supply: 300807820078958, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0103 } },
  { ticker: "BD", name: "Blessed Dino", emoji: "🦕", hue: 314, price: 1.17984118, supply: 609557, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "AM74", name: "Alpha Meerkat", emoji: "🦡", hue: 129, price: 1.44602e-05, supply: 7037947076498, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Alpha Meerkat launched silently and the chart is unpredictable.", over: { rugRisk: 4.79e-05 } },
  { ticker: "LAV88", name: "LavaCoin", emoji: "🔑", hue: 9, price: 0.46759482, supply: 3293253997, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "NOV46", name: "NovaSwap", emoji: "🤖", hue: 319, price: 9.35e-08, supply: 7029942586333, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0087 } },
  { ticker: "ATO18", name: "AtomicMint", emoji: "👽", hue: 123, price: 0.0004510586, supply: 1703465968746, pattern: "meme", description: "AtomicMint — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0174 } },
  { ticker: "CE12", name: "Cooked Echidna", emoji: "⚡", hue: 355, price: 23.30207986, supply: 109102, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000169 } },
  { ticker: "DE65", name: "Drunk Echidna", emoji: "🌀", hue: 64, price: 196.086589, supply: 1903004, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "DRI15", name: "DriftCoin", emoji: "🎰", hue: 295, price: 0.0002626041, supply: 802718565, pattern: "shady", description: "Anonymous team. No doxxing. High risk. DriftCoin launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001424 } },
  { ticker: "CYBE", name: "CyberCore", emoji: "🎭", hue: 321, price: 4.564e-07, supply: 10907654764859, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 9.43e-05 } },
  { ticker: "AW82", name: "Ancient Wombat", emoji: "🦔", hue: 48, price: 17.34918468, supply: 16854, pattern: "crash", description: "Ancient Wombat has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -7.6e-05 } },
  { ticker: "ULTR", name: "UltraNetwork", emoji: "☠️", hue: 117, price: 5.062e-05, supply: 3694675063, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000195 } },
  { ticker: "CT", name: "Cursed Tiger", emoji: "🐯", hue: 1, price: 2.143e-07, supply: 674571996950, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 0.0001 } },
  { ticker: "DP", name: "Drunk Panda", emoji: "🐼", hue: 28, price: 1.354124, supply: 56509687, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "DEG13", name: "DegenRocket", emoji: "💩", hue: 248, price: 0.0318594115, supply: 1395406977, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "DO", name: "Dank Octopus", emoji: "🐙", hue: 27, price: 104.648932, supply: 2556, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "HYP36", name: "HypeSOL", emoji: "🩸", hue: 106, price: 2.893e-05, supply: 11589486192, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000189 } },
  { ticker: "RD", name: "Rekt Dog", emoji: "🐶", hue: 90, price: 49.787943, supply: 22411, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CH", name: "Cracked Hawk", emoji: "🦅", hue: 349, price: 8.78e-08, supply: 6267460444831455, pattern: "meme", description: "Launched on pump.fun in minutes. Based hawk meme with extreme volatility.", over: { vol: 0.0157 } },
  { ticker: "MOON", name: "MoonNet", emoji: "👽", hue: 313, price: 0.7182128757, supply: 2461111960, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "MP", name: "Mega Panda", emoji: "🐼", hue: 307, price: 1.6756e-06, supply: 146857904672434, pattern: "meme", description: "Launched on pump.fun in minutes. Based panda meme with extreme volatility.", over: { vol: 0.0095 } },
  { ticker: "ST15", name: "Shadow Tardigrade", emoji: "🏦", hue: 29, price: 1.001, supply: 6443585713, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "AE6", name: "Angry Eagle", emoji: "🦅", hue: 218, price: 0.39721169, supply: 2039605840, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000138 } },
  { ticker: "ROC52", name: "RockDAO", emoji: "🗑️", hue: 211, price: 0.00191367, supply: 152222909, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -7.6e-05 } },
  { ticker: "RF", name: "Rekt Fox", emoji: "🦊", hue: 92, price: 0.039172, supply: 1236609344, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "FRO13", name: "FrostGem", emoji: "🛸", hue: 181, price: 3.56182561, supply: 87181, pattern: "moon", description: "FrostGem aims for the stars. High drift, high risk, high reward.", over: { drift: 9.6e-05 } },
  { ticker: "DEG52", name: "DegenCoin", emoji: "🌋", hue: 11, price: 0.00816446, supply: 31407949, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000153 } },
  { ticker: "GW", name: "Golden Walrus", emoji: "🦭", hue: 128, price: 4.351e-05, supply: 5352609716, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 6.9e-05 } },
  { ticker: "SILE", name: "SilentInu", emoji: "💎", hue: 31, price: 5.698779, supply: 4566865, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "BA77", name: "Blessed Ape", emoji: "🦍", hue: 31, price: 6.487e-07, supply: 430076035509, pattern: "meme", description: "The blessed ape meme coin on Solana. No utility. 100% community.", over: { vol: 0.015 } },
  { ticker: "CQ72", name: "Cosmic Quokka", emoji: "🐾", hue: 193, price: 0.533529, supply: 357134385, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "STAR", name: "StarSwap", emoji: "💩", hue: 194, price: 0.0291841541, supply: 48434361, pattern: "meme", description: "StarSwap — pure meme energy on Solana. No utility. 100% community." },
  { ticker: "PULS", name: "PulseCoin", emoji: "🚀", hue: 324, price: 0.00018614, supply: 2219674267, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000192 } },
  { ticker: "PIX49", name: "PixelFi", emoji: "🔮", hue: 140, price: 0.939248, supply: 3114752, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "GN", name: "Goated Numbat", emoji: "🌙", hue: 119, price: 15.25440567, supply: 30602, pattern: "moon", description: "Goated Numbat aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000192 } },
  { ticker: "BP", name: "Blessed Penguin", emoji: "🐧", hue: 326, price: 9.5148e-06, supply: 157216863409, pattern: "meme", description: "The blessed penguin meme coin on Solana. No utility. 100% community.", over: { vol: 0.0113 } },
  { ticker: "CP", name: "Cooked Penguin", emoji: "🐧", hue: 357, price: 2.079e-05, supply: 241093351049, pattern: "moon", description: "Cooked Penguin aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000199 } },
  { ticker: "NP", name: "Ninja Panda", emoji: "🐼", hue: 338, price: 0.9992, supply: 1599004923, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "AP30", name: "Alpha Parrot", emoji: "🦜", hue: 4, price: 3.17952e-05, supply: 12075909800870, pattern: "meme", description: "Launched on pump.fun in minutes. Based parrot meme with extreme volatility.", over: { vol: 0.0176 } },
  { ticker: "SUNC", name: "SunCash", emoji: "💎", hue: 103, price: 1.446677, supply: 149457, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "LUC38", name: "LuckyGate", emoji: "🎲", hue: 335, price: 1.09e-08, supply: 11279197156224, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0074 } },
  { ticker: "CUL56", name: "CultCoin", emoji: "🌊", hue: 35, price: 92.940858, supply: 11975, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "LA", name: "Lazy Axolotl", emoji: "🦎", hue: 261, price: 0.00036668, supply: 1441639250, pattern: "crash", description: "Lazy Axolotl has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.00014 } },
  { ticker: "CQ83", name: "Chad Quokka", emoji: "🐾", hue: 225, price: 1.88341255, supply: 551129, pattern: "crash", description: "Chad Quokka has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000188 } },
  { ticker: "GB", name: "Golden Bear", emoji: "🐻", hue: 107, price: 295.184286, supply: 170111, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "GEMS", name: "GemSwap", emoji: "💩", hue: 180, price: 0.0005220173, supply: 92982669458, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0176 } },
  { ticker: "DC36", name: "Dank Capybara", emoji: "🦫", hue: 210, price: 6.012619, supply: 542813, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "UE10", name: "Ultra Echidna", emoji: "💥", hue: 191, price: 0.32558567, supply: 4909373716, pattern: "moon", description: "Ultra Echidna aims for the stars. High drift, high risk, high reward.", over: { drift: 8.3e-05 } },
  { ticker: "ROG95", name: "RogueHub", emoji: "🤡", hue: 222, price: 0.1155821823, supply: 74375048, pattern: "meme", description: "RogueHub — pure meme energy on Solana. No utility. 100% community." },
  { ticker: "GA", name: "Golden Ape", emoji: "🦍", hue: 106, price: 5.303e-05, supply: 13888324513176, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000135 } },
  { ticker: "CF91", name: "Crystal Frog", emoji: "🐸", hue: 123, price: 0.00423204, supply: 1834072686, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "GWE87", name: "GweiCash", emoji: "🌠", hue: 188, price: 0.15317964, supply: 1619152152, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000191 } },
  { ticker: "AS93", name: "Alpha Sloth", emoji: "🦥", hue: 196, price: 100.34236, supply: 14011097, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "QUA84", name: "QuantumProtocol", emoji: "💥", hue: 249, price: 0.77510357, supply: 6258399, pattern: "moon", description: "QuantumProtocol aims for the stars. High drift, high risk, high reward.", over: { drift: 7.1e-05 } },
  { ticker: "BP83", name: "Based Panda", emoji: "🐼", hue: 73, price: 0.4933922, supply: 31176829, pattern: "moon", description: "Based Panda aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000162 } },
  { ticker: "NA", name: "Ninja Axolotl", emoji: "🦎", hue: 323, price: 0.00022082, supply: 9055053837392, pattern: "moon", description: "Ninja Axolotl aims for the stars. High drift, high risk, high reward.", over: { drift: 8.6e-05 } },
  { ticker: "STOR", name: "StormMoon", emoji: "💎", hue: 268, price: 12.89394, supply: 45604317, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CB22", name: "Crystal Binturong", emoji: "🤖", hue: 23, price: 0.0030949026, supply: 49805288, pattern: "meme", description: "Launched on pump.fun in minutes. Based binturong meme with extreme volatility." },
  { ticker: "DB", name: "Dank Binturong", emoji: "🐧", hue: 14, price: 0.0059090884, supply: 39776665161, pattern: "meme", description: "The dank binturong meme coin on Solana. No utility. 100% community." },
  { ticker: "DW", name: "Drunk Whale", emoji: "🐋", hue: 35, price: 0.16682606, supply: 170265645, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000197 } },
  { ticker: "AF54", name: "Alpha Flamingo", emoji: "🦩", hue: 180, price: 27.49600054, supply: 11863264, pattern: "crash", description: "Alpha Flamingo has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -7.5e-05 } },
  { ticker: "DE14", name: "Drunk Echidna", emoji: "🕶️", hue: 268, price: 0.0156300322, supply: 1059209526, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Drunk Echidna launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001289 } },
  { ticker: "PEA56", name: "PeakDAO", emoji: "⚡", hue: 21, price: 4.385e-05, supply: 18799206546082, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 6.3e-05 } },
  { ticker: "DEG65", name: "DegenSOL", emoji: "🌑", hue: 45, price: 5.37408e-05, supply: 85233030419, pattern: "shady", description: "Anonymous team. No doxxing. High risk. DegenSOL launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001021 } },
  { ticker: "CA18", name: "Cosmic Axolotl", emoji: "🦎", hue: 117, price: 1.854e-05, supply: 47603482159803, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000146 } },
  { ticker: "DO1", name: "Drunk Octopus", emoji: "🐙", hue: 166, price: 0.142140357, supply: 849217, pattern: "meme", description: "The drunk octopus meme coin on Solana. No utility. 100% community." },
  { ticker: "SHA55", name: "ShadowNode", emoji: "🤡", hue: 116, price: 1e-08, supply: 173433715813817, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0168 } },
  { ticker: "SB64", name: "Spicy Bear", emoji: "🐻", hue: 165, price: 6.368818, supply: 18476, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "BB", name: "Baby Binturong", emoji: "🍕", hue: 312, price: 1.462e-07, supply: 42337221185881, pattern: "meme", description: "The baby binturong meme coin on Solana. No utility. 100% community.", over: { vol: 0.0119 } },
  { ticker: "SP", name: "Stoned Parrot", emoji: "🦜", hue: 133, price: 1.13387449, supply: 13450393, pattern: "crash", description: "Stoned Parrot has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -9e-05 } },
  { ticker: "AE96", name: "Alpha Echidna", emoji: "💥", hue: 65, price: 1.299e-05, supply: 18960033097483, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 8.7e-05 } },
  { ticker: "NEON", name: "NeonHub", emoji: "〰️", hue: 334, price: 35.942773, supply: 10427, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "VOI62", name: "VoidDAO", emoji: "😤", hue: 12, price: 0.073066, supply: 4232144996, pattern: "crash", description: "VoidDAO has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -6e-05 } },
  { ticker: "SUNN", name: "SunNet", emoji: "🦊", hue: 114, price: 2.5e-09, supply: 288393673729283, pattern: "meme", description: "SunNet — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0098 } },
  { ticker: "OP", name: "Omega Parrot", emoji: "🦜", hue: 9, price: 0.00059319, supply: 292909202393, pattern: "moon", description: "Omega Parrot aims for the stars. High drift, high risk, high reward.", over: { drift: 6.6e-05 } },
  { ticker: "ROC16", name: "RockCoin", emoji: "💥", hue: 91, price: 3.93909886, supply: 1922844, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 5e-05 } },
  { ticker: "GWE64", name: "GweiCoin", emoji: "🐶", hue: 123, price: 0.001692842, supply: 2245710275, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "COS24", name: "CosmicRocket", emoji: "🎭", hue: 1, price: 8.11465e-05, supply: 29666765247, pattern: "meme", description: "CosmicRocket — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0112 } },
  { ticker: "DN", name: "Dank Numbat", emoji: "🛸", hue: 26, price: 0.00014673, supply: 55302446578, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.00016 } },
  { ticker: "QUBR", name: "HypeSwap", emoji: "🌊", hue: 284, price: 0.810531, supply: 19862263, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "RO", name: "Rekt Octopus", emoji: "🐙", hue: 101, price: 5.72e-05, supply: 18097858204, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "SUN87", name: "SunSwap", emoji: "⚡", hue: 27, price: 0.01410776, supply: 279300305, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000195 } },
  { ticker: "ZAPP", name: "ZappyProtocol", emoji: "🎲", hue: 135, price: 6.753e-07, supply: 2339679094766, pattern: "meme", description: "ZappyProtocol — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0167 } },
  { ticker: "SP16", name: "Stoned Platypus", emoji: "🦦", hue: 146, price: 0.999, supply: 2768372417, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "LUC16", name: "LuckyPump", emoji: "☀️", hue: 271, price: 0.043429, supply: 4794244, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "TN", name: "Turbo Narwhal", emoji: "🦄", hue: 162, price: 3.44003e-05, supply: 5530223631, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 7.68e-05 } },
  { ticker: "VOI29", name: "VoidCoin", emoji: "🕶️", hue: 255, price: 7.693e-07, supply: 951320537414, pattern: "shady", description: "Anonymous team. No doxxing. High risk. VoidCoin launched silently and the chart is unpredictable.", over: { rugRisk: 6.6e-05 } },
  { ticker: "SL48", name: "Sigma Lemur", emoji: "🐒", hue: 357, price: 1.571542, supply: 1075568126, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "LM", name: "Lazy Mantis", emoji: "🦗", hue: 273, price: 0.0029500334, supply: 6183093970, pattern: "meme", description: "Launched on pump.fun in minutes. Based mantis meme with extreme volatility." },
  { ticker: "DB60", name: "Degen Bear", emoji: "🐻", hue: 56, price: 0.0013212376, supply: 2295025320, pattern: "meme", description: "The degen bear meme coin on Solana. No utility. 100% community." },
  { ticker: "AA", name: "Angry Ape", emoji: "🦍", hue: 280, price: 1.31e-08, supply: 34741840082996, pattern: "meme", description: "The angry ape meme coin on Solana. No utility. 100% community.", over: { vol: 0.013 } },
  { ticker: "NOV37", name: "NovaCoin", emoji: "🌀", hue: 289, price: 94.409807, supply: 12671, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "DB76", name: "Drunk Bull", emoji: "🐂", hue: 93, price: 265.817147, supply: 1732, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "CURS", name: "CursedCoin", emoji: "🐱", hue: 227, price: 2.6e-09, supply: 22076915838735852, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0081 } },
  { ticker: "DEG4", name: "DegenSwap", emoji: "💩", hue: 230, price: 3.03629e-05, supply: 1640997695867, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0123 } },
  { ticker: "SM", name: "Sacred Mantis", emoji: "🦗", hue: 130, price: 1.20753e-05, supply: 7583150894916, pattern: "meme", description: "The sacred mantis meme coin on Solana. No utility. 100% community.", over: { vol: 0.0165 } },
  { ticker: "NA41", name: "Ninja Axolotl", emoji: "🦎", hue: 304, price: 10.72495646, supply: 220289, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000148 } },
  { ticker: "SF14", name: "Sigma Flamingo", emoji: "🦩", hue: 254, price: 0.00082167, supply: 12348524628, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "US", name: "Ultra Sloth", emoji: "🦥", hue: 198, price: 11.19816733, supply: 561387, pattern: "moon", description: "Ultra Sloth aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000153 } },
  { ticker: "SURG", name: "SurgeChain", emoji: "🤖", hue: 231, price: 2.72e-08, supply: 70652154155837984, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0088 } },
  { ticker: "MB65", name: "Mega Bull", emoji: "🐂", hue: 340, price: 0.00331287, supply: 327473913, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -6.1e-05 } },
  { ticker: "RW", name: "Rekt Walrus", emoji: "🦭", hue: 109, price: 3.325782, supply: 132379268, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "SM6", name: "Sigma Mantis", emoji: "🦗", hue: 124, price: 0.762643, supply: 37194366, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "AF98", name: "Alpha Flamingo", emoji: "🦩", hue: 308, price: 0.07063169, supply: 5019831466, pattern: "moon", description: "Alpha Flamingo aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000177 } },
  { ticker: "SA", name: "Sigma Axolotl", emoji: "🦎", hue: 118, price: 35.282447, supply: 20351, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "SA61", name: "Shadow Axolotl", emoji: "🦎", hue: 281, price: 0.00996155, supply: 43880477, pattern: "crash", description: "Shadow Axolotl has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -9.4e-05 } },
  { ticker: "GIGA", name: "GigaMoney", emoji: "💥", hue: 220, price: 0.14324273, supply: 106146183, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 9.8e-05 } },
  { ticker: "ME", name: "Mega Echidna", emoji: "🍕", hue: 296, price: 0.0011594647, supply: 1413556896381, pattern: "meme", description: "Launched on pump.fun in minutes. Based echidna meme with extreme volatility." },
  { ticker: "LUC77", name: "LuckyGate", emoji: "🐸", hue: 98, price: 1.86772e-05, supply: 77283770616572, pattern: "meme", description: "LuckyGate — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0175 } },
  { ticker: "GIG93", name: "GigaLabs", emoji: "💩", hue: 143, price: 0.0003781136, supply: 1097141739108, pattern: "meme", description: "GigaLabs — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0078 } },
  { ticker: "GT", name: "Goated Tiger", emoji: "🐯", hue: 125, price: 1.5e-09, supply: 1489736716529063, pattern: "meme", description: "The goated tiger meme coin on Solana. No utility. 100% community.", over: { vol: 0.0089 } },
  { ticker: "AB", name: "Angry Binturong", emoji: "🌋", hue: 281, price: 12.87431, supply: 11353616, pattern: "moon", description: "Angry Binturong aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000106 } },
  { ticker: "ULT62", name: "UltraNetwork", emoji: "💩", hue: 289, price: 5.3616e-05, supply: 41702772406, pattern: "meme", description: "UltraNetwork — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0151 } },
  { ticker: "ULT99", name: "UltraProtocol", emoji: "😤", hue: 29, price: 4.78679938, supply: 17695517, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000132 } },
  { ticker: "SC39", name: "Sacred Croc", emoji: "🐊", hue: 318, price: 1.056e-07, supply: 14482844713938306, pattern: "meme", description: "Launched on pump.fun in minutes. Based croc meme with extreme volatility.", over: { vol: 0.0169 } },
  { ticker: "LUC41", name: "LuckyVault", emoji: "🎪", hue: 359, price: 2.0808e-05, supply: 1237210504226, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.008 } },
  { ticker: "ULT45", name: "UltraMoney", emoji: "🛸", hue: 230, price: 48.11295639, supply: 6003642, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000139 } },
  { ticker: "ICE84", name: "IceCoin", emoji: "☯️", hue: 47, price: 0.160333, supply: 71698713, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CC", name: "Cracked Croc", emoji: "🐊", hue: 344, price: 9.6e-09, supply: 16007484177269132, pattern: "meme", description: "The cracked croc meme coin on Solana. No utility. 100% community.", over: { vol: 0.0138 } },
  { ticker: "ZAP30", name: "ZappyVerse", emoji: "〰️", hue: 94, price: 0.017646, supply: 339605955, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "MOO53", name: "MoonMoon", emoji: "🌟", hue: 339, price: 11.692939, supply: 52452651, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "PN", name: "Punk Narwhal", emoji: "🦄", hue: 38, price: 0.09391797, supply: 8556879117, pattern: "crash", description: "Punk Narwhal has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000122 } },
  { ticker: "SS23", name: "Super Shark", emoji: "🦈", hue: 177, price: 0.2542749018, supply: 563631, pattern: "meme", description: "Launched on pump.fun in minutes. Based shark meme with extreme volatility." },
  { ticker: "PF", name: "Punk Frog", emoji: "🐸", hue: 30, price: 4.848e-07, supply: 80728150787046, pattern: "meme", description: "Launched on pump.fun in minutes. Based frog meme with extreme volatility.", over: { vol: 0.0073 } },
  { ticker: "CREW", name: "CrewDAO", emoji: "⚡", hue: 185, price: 9.06605126, supply: 1136457, pattern: "moon", description: "CrewDAO aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000191 } },
  { ticker: "SD24", name: "Spicy Dino", emoji: "🦕", hue: 163, price: 1.3e-09, supply: 2167635439745861, pattern: "meme", description: "Launched on pump.fun in minutes. Based dino meme with extreme volatility.", over: { vol: 0.0088 } },
  { ticker: "VOI82", name: "VoidSwap", emoji: "👽", hue: 74, price: 0.1184090389, supply: 3044550545, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "GIG42", name: "GigaInu", emoji: "☯️", hue: 347, price: 249.698206, supply: 428, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "PUL93", name: "PulseNet", emoji: "🌀", hue: 289, price: 4.919642, supply: 271028, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "NJ21", name: "Neon Jellyfish", emoji: "🪼", hue: 251, price: 4.454e-06, supply: 3255407858543, pattern: "meme", description: "Launched on pump.fun in minutes. Based jellyfish meme with extreme volatility.", over: { vol: 0.0168 } },
  { ticker: "FRO29", name: "FrostProtocol", emoji: "🎭", hue: 218, price: 9.38e-08, supply: 4002031478686, pattern: "meme", description: "FrostProtocol — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0087 } },
  { ticker: "FOMO", name: "FomoCash", emoji: "😤", hue: 155, price: 0.01692544, supply: 625901098, pattern: "crash", description: "FomoCash has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -6.5e-05 } },
  { ticker: "FUZ58", name: "FuzzyFi", emoji: "🤡", hue: 174, price: 5.66967e-05, supply: 63458498171, pattern: "meme", description: "FuzzyFi — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0093 } },
  { ticker: "ZAP22", name: "ZappyChain", emoji: "🌟", hue: 65, price: 0.348189, supply: 49680908, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "AST58", name: "AstroFi", emoji: "🤡", hue: 101, price: 0.018977052, supply: 469891053, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "SC3", name: "Spicy Capybara", emoji: "🦫", hue: 171, price: 0.00111789, supply: 290529839095, pattern: "crash", description: "Spicy Capybara has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -7.8e-05 } },
  { ticker: "CB8", name: "Chad Bear", emoji: "🐻", hue: 249, price: 0.2577776083, supply: 768436, pattern: "meme", description: "Launched on pump.fun in minutes. Based bear meme with extreme volatility." },
  { ticker: "ST49", name: "Shadow Tardigrade", emoji: "🏔️", hue: 126, price: 1.281335, supply: 686873505, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "ATO84", name: "AtomicCore", emoji: "⚡", hue: 336, price: 10.51976572, supply: 30777, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000155 } },
  { ticker: "NINJ", name: "NinjaCoin", emoji: "🗑️", hue: 183, price: 1.5e-06, supply: 1279902551835, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000158 } },
  { ticker: "COR20", name: "CoreDAO", emoji: "😭", hue: 116, price: 0.0001325, supply: 8121087751118, pattern: "crash", description: "CoreDAO has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000159 } },
  { ticker: "FUZ27", name: "FuzzyCoin", emoji: "🔮", hue: 80, price: 0.020711, supply: 1731292809, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "TUR6", name: "TurboVerse", emoji: "👾", hue: 125, price: 4.1724e-06, supply: 244069959568, pattern: "meme", description: "TurboVerse — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0099 } },
  { ticker: "BLA30", name: "BlazeMoon", emoji: "🐧", hue: 156, price: 0.021982461, supply: 6370922556, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "SUR19", name: "SurgeChain", emoji: "🐧", hue: 56, price: 0.7434641756, supply: 23477744, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "CS72", name: "Cooked Shark", emoji: "🦈", hue: 315, price: 0.02946765, supply: 51582687298, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 9.2e-05 } },
  { ticker: "CT39", name: "Cursed Tardigrade", emoji: "🐶", hue: 79, price: 2.4442e-06, supply: 71883551139380, pattern: "meme", description: "Launched on pump.fun in minutes. Based tardigrade meme with extreme volatility.", over: { vol: 0.0096 } },
  { ticker: "GJ", name: "Golden Jellyfish", emoji: "🪼", hue: 115, price: 4.391721, supply: 331011196, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "BB48", name: "Based Bull", emoji: "🐂", hue: 180, price: 4.439e-05, supply: 2945611298623, pattern: "moon", description: "Based Bull aims for the stars. High drift, high risk, high reward.", over: { drift: 5.7e-05 } },
  { ticker: "RN", name: "Rekt Numbat", emoji: "💎", hue: 100, price: 127.384425, supply: 5060, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "PUL28", name: "PulseNet", emoji: "📉", hue: 77, price: 16.41212841, supply: 83706565, pattern: "crash", description: "PulseNet has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000136 } },
  { ticker: "COR27", name: "CoreSwap", emoji: "👾", hue: 123, price: 3.7127e-06, supply: 288190576220, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0162 } },
  { ticker: "DQ", name: "Drunk Quokka", emoji: "🐾", hue: 29, price: 2.26e-07, supply: 71044568650586, pattern: "meme", description: "Launched on pump.fun in minutes. Based quokka meme with extreme volatility.", over: { vol: 0.0087 } },
  { ticker: "VIBE", name: "VibeCoin", emoji: "💀", hue: 174, price: 0.00071457, supply: 8438811783, pattern: "crash", description: "VibeCoin has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000104 } },
  { ticker: "CW93", name: "Cracked Wombat", emoji: "🦔", hue: 262, price: 5.7306e-06, supply: 78945240376, pattern: "meme", description: "Launched on pump.fun in minutes. Based wombat meme with extreme volatility.", over: { vol: 0.0117 } },
  { ticker: "NIN84", name: "NinjaPump", emoji: "🌀", hue: 127, price: 271.213684, supply: 10436, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "AST94", name: "AstroGem", emoji: "🎊", hue: 221, price: 0.58864449, supply: 908163, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "ROC10", name: "RockMoon", emoji: "🌊", hue: 85, price: 276.318895, supply: 270772, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "NOV2", name: "NovaFi", emoji: "⚡", hue: 53, price: 0.00033965, supply: 26932681957, pattern: "moon", description: "NovaFi aims for the stars. High drift, high risk, high reward.", over: { drift: 9.4e-05 } },
  { ticker: "FUZ63", name: "FuzzyPump", emoji: "💩", hue: 200, price: 1.4e-09, supply: 13897408598766910, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0143 } },
  { ticker: "LAV3", name: "LavaCore", emoji: "🟢", hue: 98, price: 1.0, supply: 15333512011, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "STO20", name: "StormFi", emoji: "🤡", hue: 164, price: 1.475e-07, supply: 313981437630739, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0136 } },
  { ticker: "OB", name: "Omega Bull", emoji: "🐂", hue: 355, price: 0.4302096496, supply: 21901957, pattern: "meme", description: "The omega bull meme coin on Solana. No utility. 100% community." },
  { ticker: "TF", name: "Turbo Frog", emoji: "🐸", hue: 154, price: 0.0027019, supply: 1550773446, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "SB56", name: "Silver Bull", emoji: "🐂", hue: 136, price: 10.725061, supply: 247973, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "NOV89", name: "NovaChain", emoji: "🎰", hue: 86, price: 0.3020373272, supply: 36735028, pattern: "shady", description: "Anonymous team. No doxxing. High risk. NovaChain launched silently and the chart is unpredictable.", over: { rugRisk: 5.21e-05 } },
  { ticker: "LAV85", name: "LavaCore", emoji: "🕶️", hue: 6, price: 1.739e-07, supply: 5680053112863045, pattern: "shady", description: "The dev wallet holds a suspiciously large supply. Trade at your own risk.", over: { rugRisk: 4.14e-05 } },
  { ticker: "GM", name: "Golden Mantis", emoji: "🦗", hue: 118, price: 0.9992, supply: 9081300879, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "CYB89", name: "CyberInu", emoji: "🤖", hue: 245, price: 0.0032920933, supply: 4329651508, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "HA", name: "Hyper Axolotl", emoji: "🦎", hue: 137, price: 357.214018, supply: 7092, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "RQ", name: "Royal Quokka", emoji: "🐾", hue: 103, price: 0.2953150666, supply: 24384023, pattern: "meme", description: "Launched on pump.fun in minutes. Based quokka meme with extreme volatility." },
  { ticker: "SIL11", name: "SilentVerse", emoji: "⚡", hue: 30, price: 0.181632, supply: 23724605, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "CB40", name: "Cosmic Bull", emoji: "🐂", hue: 83, price: 1.00606e-05, supply: 18704677022459, pattern: "meme", description: "The cosmic bull meme coin on Solana. No utility. 100% community.", over: { vol: 0.0089 } },
  { ticker: "DL", name: "Dank Lemur", emoji: "🐒", hue: 24, price: 0.030575, supply: 7944871, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "GWE53", name: "GweiSOL", emoji: "🐧", hue: 91, price: 3.0917e-06, supply: 74833803111, pattern: "meme", description: "GweiSOL — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0102 } },
  { ticker: "AW35", name: "Alpha Wolf", emoji: "🐺", hue: 256, price: 5.131e-07, supply: 25747724430720, pattern: "meme", description: "The alpha wolf meme coin on Solana. No utility. 100% community.", over: { vol: 0.0079 } },
  { ticker: "LW", name: "Lazy Walrus", emoji: "🦭", hue: 283, price: 0.022985, supply: 52616700, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "AJ", name: "Atomic Jellyfish", emoji: "🪼", hue: 289, price: 1.66e-08, supply: 6441671457263, pattern: "meme", description: "Launched on pump.fun in minutes. Based jellyfish meme with extreme volatility.", over: { vol: 0.0163 } },
  { ticker: "SIL43", name: "SilentNetwork", emoji: "🌋", hue: 125, price: 0.01033507, supply: 33708260991, pattern: "moon", description: "SilentNetwork aims for the stars. High drift, high risk, high reward.", over: { drift: 9.6e-05 } },
  { ticker: "EKIT", name: "LuckyChain", emoji: "🌋", hue: 241, price: 0.26935016, supply: 5395861844, pattern: "moon", description: "LuckyChain aims for the stars. High drift, high risk, high reward.", over: { drift: 0.00011 } },
  { ticker: "OE", name: "Omega Echidna", emoji: "🌙", hue: 358, price: 33.45569592, supply: 21621, pattern: "moon", description: "Omega Echidna aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000123 } },
  { ticker: "SHA27", name: "ShadowGem", emoji: "👾", hue: 25, price: 8.8327e-06, supply: 202735958284, pattern: "meme", description: "ShadowGem — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0143 } },
  { ticker: "DEG82", name: "DegenDAO", emoji: "🐶", hue: 104, price: 5.315e-07, supply: 2297673087366, pattern: "meme", description: "DegenDAO — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.008 } },
  { ticker: "FIR62", name: "FireDAO", emoji: "🎭", hue: 59, price: 0.0001738586, supply: 114323113374, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.013 } },
  { ticker: "FOM82", name: "FomoMoon", emoji: "☠️", hue: 182, price: 10.96346377, supply: 26943, pattern: "crash", description: "FomoMoon has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -7.8e-05 } },
  { ticker: "SM87", name: "Super Meerkat", emoji: "🦡", hue: 1, price: 0.0006617477, supply: 2175661091533, pattern: "meme", description: "Launched on pump.fun in minutes. Based meerkat meme with extreme volatility.", over: { vol: 0.0167 } },
  { ticker: "BL29", name: "Baby Lion", emoji: "🦁", hue: 9, price: 0.01158931, supply: 1469965618, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "CF45", name: "Cooked Flamingo", emoji: "🦩", hue: 332, price: 96.36494501, supply: 123735, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000105 } },
  { ticker: "FLA40", name: "FlashPad", emoji: "🌠", hue: 311, price: 0.00252038, supply: 93692053856, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000117 } },
  { ticker: "DN39", name: "Dank Narwhal", emoji: "🦄", hue: 344, price: 2.055e-05, supply: 5549705391346, pattern: "moon", description: "Dank Narwhal aims for the stars. High drift, high risk, high reward.", over: { drift: 8.9e-05 } },
  { ticker: "ATO32", name: "AtomicCash", emoji: "👾", hue: 179, price: 4.40499e-05, supply: 536831244546, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0121 } },
  { ticker: "NOV24", name: "NovaCash", emoji: "💩", hue: 255, price: 4.76e-08, supply: 1410893035073253, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0095 } },
  { ticker: "MYS55", name: "MysticGem", emoji: "🏦", hue: 55, price: 0.9996, supply: 15751599920, pattern: "stable", description: "Dollar-pegged stablecoin on Solana. Low volatility by design." },
  { ticker: "SIL69", name: "SilentFi", emoji: "🌙", hue: 193, price: 0.00020357, supply: 12398156277, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 9e-05 } },
  { ticker: "AST77", name: "AstroLabs", emoji: "🏔️", hue: 162, price: 0.6702, supply: 7280129, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "VOI87", name: "VoidNet", emoji: "🌙", hue: 79, price: 8.662e-05, supply: 3709439771, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 5.9e-05 } },
  { ticker: "GF", name: "Golden Flamingo", emoji: "🦩", hue: 111, price: 0.923194, supply: 424305, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "DS63", name: "Drunk Shark", emoji: "🦈", hue: 196, price: 0.00105158, supply: 606560726, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000163 } },
  { ticker: "MOO25", name: "MoonDAO", emoji: "🐶", hue: 248, price: 0.0217241837, supply: 64344933700, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility." },
  { ticker: "DP11", name: "Dank Penguin", emoji: "🐧", hue: 36, price: 0.09073704, supply: 2919597421, pattern: "moon", description: "Dank Penguin aims for the stars. High drift, high risk, high reward.", over: { drift: 0.00015 } },
  { ticker: "DS59", name: "Drunk Sloth", emoji: "🦥", hue: 171, price: 0.09110731, supply: 2307795598, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 6.3e-05 } },
  { ticker: "NC", name: "Neon Croc", emoji: "🐊", hue: 325, price: 0.01518302, supply: 120366329741, pattern: "crash", description: "Neon Croc has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000102 } },
  { ticker: "NM95", name: "Ninja Mantaray", emoji: "🐱", hue: 115, price: 0.0295553733, supply: 5766642931, pattern: "meme", description: "Launched on pump.fun in minutes. Based mantaray meme with extreme volatility." },
  { ticker: "AQ", name: "Ancient Quokka", emoji: "🐾", hue: 296, price: 0.0918247804, supply: 84235067, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Ancient Quokka launched silently and the chart is unpredictable.", over: { rugRisk: 8.18e-05 } },
  { ticker: "CQ91", name: "Cooked Quokka", emoji: "🐾", hue: 254, price: 0.0003107107, supply: 22346173388, pattern: "meme", description: "The cooked quokka meme coin on Solana. No utility. 100% community.", over: { vol: 0.0177 } },
  { ticker: "ROC69", name: "RockSwap", emoji: "🍕", hue: 249, price: 3.387e-07, supply: 61297742528260, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0135 } },
  { ticker: "GC", name: "Goated Croc", emoji: "🐊", hue: 108, price: 8.18332527, supply: 10203682, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "DEG84", name: "DegenSOL", emoji: "💡", hue: 106, price: 0.039468, supply: 13451965856, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "SM19", name: "Sacred Mantis", emoji: "🦗", hue: 146, price: 5.167795, supply: 276984, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "TM", name: "Turbo Mantis", emoji: "🦗", hue: 161, price: 0.72933207, supply: 813659982, pattern: "moon", description: "Community-driven moon mission on Solana. The chart only knows one direction.", over: { drift: 0.000133 } },
  { ticker: "BB82", name: "Baby Bull", emoji: "🐂", hue: 298, price: 0.0965746, supply: 35963651, pattern: "launch", description: "Fresh launch on Solana. Early, unproven, and wildly unpredictable. DYOR." },
  { ticker: "BH", name: "Blessed Hawk", emoji: "🦅", hue: 318, price: 2.611e-07, supply: 1399342008158026, pattern: "meme", description: "Launched on pump.fun in minutes. Based hawk meme with extreme volatility.", over: { vol: 0.0162 } },
  { ticker: "SA98", name: "Sleepy Axolotl", emoji: "🦎", hue: 21, price: 2.36e-06, supply: 113595714836, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000173 } },
  { ticker: "WAV1", name: "WaveDAO", emoji: "⚖️", hue: 197, price: 1.002, supply: 5331116584, pattern: "stable", description: "Dollar-pegged stablecoin on Solana. Low volatility by design." },
  { ticker: "CB47", name: "Cyber Bull", emoji: "🐂", hue: 90, price: 6.7313e-06, supply: 590489598311, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Cyber Bull launched silently and the chart is unpredictable.", over: { rugRisk: 6.96e-05 } },
  { ticker: "RSAM", name: "ShadowVault", emoji: "🔮", hue: 37, price: 0.042029, supply: 22351394, pattern: "steady", description: "Infrastructure token building real utility across the Solana ecosystem." },
  { ticker: "CUR89", name: "CursedSwap", emoji: "⚖️", hue: 137, price: 0.9985, supply: 1319274494, pattern: "stable", description: "Stable value reserve token. Pegged 1:1 to USD." },
  { ticker: "STO39", name: "StormCoin", emoji: "🏔️", hue: 204, price: 0.044093, supply: 4811794731, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "COS2", name: "CosmicLabs", emoji: "🎭", hue: 219, price: 0.0003110808, supply: 1633040653, pattern: "meme", description: "Launched on pump.fun in minutes. Degen community with extreme volatility.", over: { vol: 0.0129 } },
  { ticker: "QUA88", name: "QuantumRocket", emoji: "🎭", hue: 253, price: 9.582e-06, supply: 89726289702, pattern: "meme", description: "QuantumRocket — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0165 } },
  { ticker: "AQ41", name: "Alpha Quokka", emoji: "🐾", hue: 277, price: 52.148942, supply: 22309, pattern: "steady", description: "Layer-1 adjacent protocol with consistent growth trajectory on Solana." },
  { ticker: "SHA89", name: "ShadowNode", emoji: "🌙", hue: 213, price: 0.013367, supply: 32903312344, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "MYS83", name: "MysticMoney", emoji: "🌙", hue: 146, price: 0.018048, supply: 40319930354, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "SN", name: "Sleepy Numbat", emoji: "📉", hue: 131, price: 0.01167514, supply: 137354155266, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000121 } },
  { ticker: "GT70", name: "Goated Tardigrade", emoji: "🎭", hue: 198, price: 0.0096868012, supply: 19693674268, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Goated Tardigrade launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001283 } },
  { ticker: "AH", name: "Ancient Hawk", emoji: "🦅", hue: 287, price: 0.2010081194, supply: 5985322042, pattern: "meme", description: "Launched on pump.fun in minutes. Based hawk meme with extreme volatility." },
  { ticker: "ZAP90", name: "ZappyRocket", emoji: "🩸", hue: 280, price: 0.00125061, supply: 45482904790, pattern: "crash", description: "ZappyRocket has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -0.000121 } },
  { ticker: "AH69", name: "Angry Hawk", emoji: "🦅", hue: 338, price: 0.00193755, supply: 17180306602, pattern: "moon", description: "Angry Hawk aims for the stars. High drift, high risk, high reward.", over: { drift: 6.2e-05 } },
  { ticker: "SA12", name: "Sacred Ape", emoji: "🦍", hue: 127, price: 29.67524276, supply: 10628, pattern: "moon", description: "Sacred Ape aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000185 } },
  { ticker: "SHA2", name: "ShadowCash", emoji: "🌙", hue: 150, price: 0.90220296, supply: 115309907, pattern: "moon", description: "ShadowCash aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000157 } },
  { ticker: "SD48", name: "Stoned Dino", emoji: "🦕", hue: 229, price: 9.49e-06, supply: 24119675222010, pattern: "crash", description: "Formerly hyped project now struggling. Volume has disappeared post-launch.", over: { drift: -0.000125 } },
  { ticker: "MA", name: "Mega Axolotl", emoji: "🦎", hue: 292, price: 7.3101e-06, supply: 2450131302242, pattern: "meme", description: "Launched on pump.fun in minutes. Based axolotl meme with extreme volatility.", over: { vol: 0.0169 } },
  { ticker: "COS66", name: "CosmicPump", emoji: "🎪", hue: 127, price: 1.7423e-06, supply: 8085645271088, pattern: "meme", description: "CosmicPump — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0158 } },
  { ticker: "CM30", name: "Cosmic Meerkat", emoji: "🦡", hue: 183, price: 1.5327091, supply: 66924, pattern: "moon", description: "Cosmic Meerkat aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000152 } },
  { ticker: "AF5", name: "Alpha Fox", emoji: "🦊", hue: 248, price: 3.961823, supply: 215288718, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "DC10", name: "Degen Croc", emoji: "🐊", hue: 142, price: 4.848756, supply: 67284, pattern: "wave", description: "Cyclical DeFi token with wave-like price action following liquidity cycles." },
  { ticker: "SUN60", name: "SunCash", emoji: "🌊", hue: 318, price: 117.343617, supply: 1809278, pattern: "wave", description: "AMM and yield protocol with oscillating demand on Solana." },
  { ticker: "PIX38", name: "PixelProtocol", emoji: "🔥", hue: 108, price: 0.08843968, supply: 22933792, pattern: "moon", description: "PixelProtocol aims for the stars. High drift, high risk, high reward.", over: { drift: 0.000143 } },
  { ticker: "AST70", name: "AstroChain", emoji: "😤", hue: 155, price: 0.71602767, supply: 1582589, pattern: "crash", description: "AstroChain has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -6.8e-05 } },
  { ticker: "DQ89", name: "Drunk Quokka", emoji: "🐾", hue: 142, price: 0.2537776636, supply: 4850474752, pattern: "shady", description: "Anonymous team. No doxxing. High risk. Drunk Quokka launched silently and the chart is unpredictable.", over: { rugRisk: 0.0001088 } },
  { ticker: "LL68", name: "Lazy Lion", emoji: "🦁", hue: 322, price: 0.7047606981, supply: 9069823, pattern: "meme", description: "The lazy lion meme coin on Solana. No utility. 100% community." },
  { ticker: "CB30", name: "Cyber Bull", emoji: "🐂", hue: 52, price: 2.41949557, supply: 7108454, pattern: "launch", description: "Brand new community token. First day of trading. Anything can happen." },
  { ticker: "SALT", name: "SaltySwap", emoji: "☠️", hue: 278, price: 1.066e-05, supply: 31544800758036, pattern: "crash", description: "SaltySwap has seen better days. Trending down with occasional dead cat bounces.", over: { drift: -7.6e-05 } },
  { ticker: "SS34", name: "Shadow Snake", emoji: "🐍", hue: 209, price: 0.0455222115, supply: 21120824099, pattern: "meme", description: "Launched on pump.fun in minutes. Based snake meme with extreme volatility." },
  { ticker: "POC30", name: "PocketGem", emoji: "🐧", hue: 265, price: 4.7e-09, supply: 158407313336847, pattern: "meme", description: "PocketGem — pure meme energy on Solana. No utility. 100% community.", over: { vol: 0.0178 } },
];

const jit = (v: number, lo = 0.8, hi = 1.25) => v * rand(lo, hi);
const logUniform = (a: number, b: number) => Math.exp(rand(Math.log(a), Math.log(b)));

export function buildCoin(
  seed: Omit<CoinSeed, "over"> & { over?: Partial<Coin> },
  now: number,
  creator: "system" | "user" = "system"
): Coin {
  const p = PROFILES[seed.pattern];
  const c: Coin = {
    id: seed.ticker,
    name: seed.name,
    ticker: seed.ticker,
    emoji: seed.emoji,
    hue: seed.hue,
    description: seed.description,
    price: seed.price,
    prev: seed.price,
    supply: seed.supply,
    startPrice: seed.price,
    pattern: seed.pattern,
    creator,
    createdAt: now,

    drift: seed.pattern === "stable" ? 0 : p.drift === 0 ? 0 : jit(p.drift, 0.7, 1.3),
    vol: jit(p.vol),
    revert: p.revert,
    eventRate: jit(p.eventRate, 0.7, 1.4),
    pumpBias: Math.min(0.9, Math.max(0.1, p.pumpBias + rand(-0.06, 0.06))),
    jumpP: p.jumpP,
    jumpSize: jit(p.jumpSize),
    waveAmp: p.waveAmp ? jit(p.waveAmp) : 0,
    wavePeriod: rand(180, 420),
    wavePhase: rand(0, Math.PI * 2),
    beta: p.beta,
    ref: seed.price,
    rugRisk: logUniform(p.rug[0], p.rug[1]) * 0.6,

    regimeKind: "none",
    regimeTicks: 0,
    shockTicks: 0,
    shockPer: 0,
    cooldown: Math.floor(rand(60, 400)),
    warnTicks: 0,
    warnText: "",
    warnReal: false,
    rugCountdown: 0,
    rugged: false,
    ruggedAt: 0,
    candles: [],

    // hype fields — only user coins use these
    hypeTier: "none",
    hypeScore: 0,
    hypeReason: "",
  };
  Object.assign(c, seed.over);
  return c;
}

/** Simulate history for a seed coin so charts are never empty. */
export function backfill(c: Coin, now: number, ticks = MAX_BACKFILL_TICKS) {
  const target = c.startPrice;
  const startTick = Math.floor(rand(0, 100000));
  const m: MarketState = { bias: 0, biasTicks: 0, heatTicks: 0, heatMult: 1 };
  c.price = 1;
  c.prev = 1;
  c.ref = 1;
  c.startPrice = 1;
  const t0 = now - ticks * 1000;
  for (let i = 0; i < ticks; i++) {
    if (i % 400 === 0) {
      m.bias = rand(-0.0004, 0.0004);
      m.biasTicks = 400;
    }
    if (m.biasTicks > 0) m.biasTicks--;
    stepCoin(c, m, t0 + i * 1000, startTick + i, null, true);
  }
  const f = target / c.price;
  for (const k of c.candles) {
    k[1] *= f;
    k[2] *= f;
    k[3] *= f;
    k[4] *= f;
    k[5] *= f;
  }
  c.price = target;
  c.prev = target;
  c.startPrice = target;
  c.ref = c.pattern === "stable" ? target : target * rand(0.93, 1.07);
  c.regimeKind = "none";
  c.regimeTicks = 0;
  c.shockTicks = 0;
  c.shockPer = 0;
  c.cooldown = Math.floor(rand(60, 400));
  c.warnTicks = 0;
}

const MAX_BACKFILL_TICKS = 600;

// ---------------------------------------------------------------------------
// New-coin generator — with hype scoring
// ---------------------------------------------------------------------------

export function launchCoin(
  init: { name: string; ticker: string; emoji: string; price: number; supply: number; description: string },
  now: number,
  creator: "system" | "user"
): Coin {
  let hue = 0;
  for (const ch of init.ticker) hue = (hue * 31 + ch.charCodeAt(0)) % 360;

  // Score the description for hype keywords
  const hype = scoreDescription(init.description);

  const bullish = Math.random();
  const baseDrift = rand(-0.0003, 0.00055);

  const c = buildCoin(
    {
      ...init,
      hue,
      pattern: "launch",
      over: {
        drift: baseDrift * hype.driftMult,
        vol: rand(0.003, 0.009) * (hype.tier === "viral" ? 1.8 : hype.tier === "high" ? 1.4 : 1),
        pumpBias: Math.min(0.92, rand(0.25, 0.75) + hype.pumpBiasBoost),
        eventRate: rand(0.0005, 0.0015) * hype.eventRateMult,
        waveAmp: Math.random() < 0.5 ? rand(0.0005, 0.002) : 0,
        // exceptional hype coins born with a launch bull run
        ...(bullish > 0.9 || hype.tier === "viral"
          ? { drift: rand(0.0004, 0.0012) * hype.driftMult, pumpBias: Math.min(0.92, 0.75 + hype.pumpBiasBoost) }
          : {}),
        hypeTier: hype.tier,
        hypeScore: hype.score,
        hypeReason: hype.reason,
      },
    },
    now,
    creator
  );

  c.candles = [];
  recordPrice(c, now, init.supply * init.price * 0.002);

  // Apply immediate launch shock for high-hype coins
  if (hype.launchShock > 0 && creator === "user") {
    applyShock(c, hype.launchShock, 4);
  }

  return c;
}

const PREFIX = ["Pixel","Turbo","Cosmic","Neon","Quantum","Giga","Mystic","Ninja","Lava","Frost","Pocket","Hyper","Cyber","Golden","Rogue","Astro","Zappy","Ultra","Salty","Fuzzy","Jolly","Atomic","Lucky","Shadow"];
const SUFFIX = ["Coin","Token","Fi","Swap","Inu","Cash","Chain","Verse","DAO","Pad"];
const EMOJIS = ["🦊","🐼","🦄","🍕","🍩","🧀","🐙","🦖","🐧","🌵","💎","🧊","🎲","🛸","🪙","🦉","🐢","🍀"];

export function randomNpcCoin(taken: Set<string>, now: number): Coin | null {
  for (let i = 0; i < 20; i++) {
    const pre = pick(PREFIX);
    const suf = pick(SUFFIX);
    let ticker = (pre.slice(0, 3) + (Math.random() < 0.5 ? suf.slice(0, 1) : "")).toUpperCase();
    if (taken.has(ticker)) ticker = ticker.slice(0, 3) + Math.floor(rand(1, 99));
    if (taken.has(ticker)) continue;
    return launchCoin(
      {
        name: `${pre}${suf === "DAO" ? " DAO" : suf}`,
        ticker,
        emoji: pick(EMOJIS),
        price: logUniform(0.00002, 40),
        supply: Math.round(logUniform(2e7, 5e11)),
        description: "A freshly launched community token. Early, risky and unpredictable.",
      },
      now,
      "system"
    );
  }
  return null;
}

export function seedCoins(now: number): Coin[] {
  // Keep initial state creation cheap. History is hydrated asynchronously by
  // the engine after the first render.
  return SEEDS.map((s) => buildCoin(s, now));
}

export function hydrateSeedCoins(coins: Coin[], now: number, onChunk: () => void) {
  let index = 0;
  const runChunk = () => {
    const end = Math.min(index + 12, coins.length);
    for (; index < end; index++) backfill(coins[index], now);
    onChunk();
    if (index < coins.length) setTimeout(runChunk, 0);
  };
  setTimeout(runChunk, 0);
}

export { BASE_MS };
