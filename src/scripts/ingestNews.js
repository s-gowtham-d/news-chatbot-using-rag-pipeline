// /**
//  * Ingest News Script
//  * Fetches news articles from RSS feed, generates embeddings, and stores them in Qdrant
//  * Uses Jina Embeddings API for embedding generation
//  * Uses Qdrant as the vector database
//  * Fetches from BBC News RSS feed
//  * If RSS fetch fails, uses sample news data
//  * Creates Qdrant collection if not exists
//  * Ingests up to 50 articles
//  * Tests search functionality after ingestion
//  * Run with: node src/scripts/ingestNews.js
//  */
// import { QdrantClient } from '@qdrant/qdrant-js';
// import axios from 'axios';
// import dotenv from 'dotenv';
// import { parseStringPromise } from 'xml2js';

// dotenv.config();

// const qdrant = new QdrantClient({
//   url: process.env.QDRANT_URL,
//   apiKey: process.env.QDRANT_API_KEY,
//   checkCompatibility: false,
//   https: true
// });

// const COLLECTION_NAME = 'news';
// const EMBEDDING_DIMENSION = 1024; 

// async function getEmbeddings(texts) {
//   try {
//     const res = await axios.post(
//       'https://api.jina.ai/v1/embeddings',
//       { 
//         input: texts, 
//         model: 'jina-embeddings-v3',
//         task: 'text-matching'  
//       },
//       { 
//         headers: { 
//           'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
//           'Content-Type': 'application/json'
//         } 
//       }
//     );
//     return res.data.data.map(d => d.embedding);
//   } catch (err) {
//     console.error('❌ Embedding error:', err.response?.data || err.message);
//     throw err;
//   }
// }
// async function fetchNewsFromRSS() {
//   try {
//     console.log('📰 Fetching news from BBC RSS...');
//     const rssUrl = 'http://feeds.bbci.co.uk/news/rss.xml';
    
//     const response = await axios.get(rssUrl, {
//       headers: { 'User-Agent': 'Mozilla/5.0' }
//     });
    
//     const parsed = await parseStringPromise(response.data);
//     const items = parsed.rss.channel[0].item || [];
    
//     console.log(`✅ Found ${items.length} articles`);
    
//     return items.slice(0, 50).map((item, idx) => ({
//       id: idx + 1,
//       title: item.title?.[0] || 'No title',
//       description: item.description?.[0] || '',
//       link: item.link?.[0] || '',
//       pubDate: item.pubDate?.[0] || '',
//       text: `${item.title?.[0] || ''}\n\n${item.description?.[0] || ''}`
//     }));
//   } catch (err) {
//     console.error('❌ Failed to fetch RSS:', err.message);
//     return [];
//   }
// }

// function getSampleNews() {
//   return [
//     {
//       id: 1,
//       title: 'Global Economy Shows Signs of Recovery',
//       text: 'Global Economy Shows Signs of Recovery\n\nEconomists report positive indicators in worldwide markets as manufacturing output increases and unemployment rates decline across major economies. The International Monetary Fund raised its global growth forecast to 3.5% for this year.',
//     },
//     {
//       id: 2,
//       title: 'Tech Giants Announce AI Breakthroughs',
//       text: 'Tech Giants Announce AI Breakthroughs\n\nMajor technology companies unveiled significant advances in artificial intelligence, promising improvements in healthcare diagnostics and climate modeling. The new models show 40% better accuracy in medical imaging analysis.',
//     },
//     {
//       id: 3,
//       title: 'Climate Summit Reaches Historic Agreement',
//       text: 'Climate Summit Reaches Historic Agreement\n\nWorld leaders commit to ambitious carbon reduction targets at international climate conference, marking a turning point in global environmental policy. Countries pledge to cut emissions by 50% by 2035.',
//     },
//     {
//       id: 4,
//       title: 'Stock Markets Hit Record Highs',
//       text: 'Stock Markets Hit Record Highs\n\nMajor indices reached all-time peaks today as investor confidence grows amid strong corporate earnings and positive economic forecasts. The S&P 500 gained 2.3% while Asian markets also surged.',
//     },
//     {
//       id: 5,
//       title: 'Breakthrough in Renewable Energy Storage',
//       text: 'Breakthrough in Renewable Energy Storage\n\nScientists develop new battery technology that could revolutionize solar and wind power storage, making renewable energy more viable. The innovation promises 10x longer battery life at half the cost.',
//     },
//     {
//       id: 6,
//       title: 'Inflation Rates Drop Across Major Economies',
//       text: 'Inflation Rates Drop Across Major Economies\n\nCentral banks report successful measures in controlling inflation as rates fall to target levels. Consumer prices increased only 2.1% year-over-year, down from 4.5% last quarter.',
//     },
//     {
//       id: 7,
//       title: 'Space Exploration Reaches New Milestone',
//       text: 'Space Exploration Reaches New Milestone\n\nInternational space agencies successfully launch crewed mission to establish lunar research station. The mission marks humanity\'s return to the Moon after decades.',
//     },
//     {
//       id: 8,
//       title: 'Medical Breakthrough in Cancer Treatment',
//       text: 'Medical Breakthrough in Cancer Treatment\n\nResearchers announce promising results from clinical trials of new immunotherapy approach. Early data shows 70% success rate in treating previously resistant forms of cancer.',
//     },
//   ];
// }

// async function createCollection() {
//   try {
//     const collections = await qdrant.getCollections();
//     const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
    
//     // if (exists) {
//     //   console.log(`⚠️  Collection '${COLLECTION_NAME}' already exists. Deleting...`);
//     //   await qdrant.deleteCollection(COLLECTION_NAME);
//     // }
//     if (!exists) {
//         console.log(`📦 Creating collection '${COLLECTION_NAME}'...`);
//         await qdrant.createCollection(COLLECTION_NAME, {
//         vectors: {
//             size: EMBEDDING_DIMENSION,
//             distance: 'Cosine'
//         }
//         });
//     }
    
//     console.log('✅ Collection created successfully');
//   } catch (err) {
//     console.error('❌ Failed to create collection:', err.message);
//     throw err;
//   }
// }

// async function ingestArticles(articles) {
//   try {
//     console.log(`\n📤 Generating embeddings for ${articles.length} articles...`);
    
//     const texts = articles.map(a => a.text);
//     const embeddings = await getEmbeddings(texts);
    
//     console.log('💾 Uploading to Qdrant...');
    
//     const points = articles.map((article, idx) => ({
//       id: article.id,
//       vector: embeddings[idx],
//       payload: {
//         title: article.title,
//         text: article.text,
//         link: article.link || '',
//         pubDate: article.pubDate || ''
//       }
//     }));
    
//     await qdrant.upsert(COLLECTION_NAME, {
//       wait: true,
//       points
//     });
    
//     console.log(`✅ Successfully ingested ${articles.length} articles`);
//   } catch (err) {
//     console.error('❌ Failed to ingest articles:', err.message);
//     throw err;
//   }
// }

// async function main() {
//   console.log('🚀 Starting news ingestion...\n');
  
//   try {
//     await createCollection();
    
//     let articles = await fetchNewsFromRSS();
    
//     if (articles.length === 0) {
//       console.log('⚠️  Using sample news data...');
//       articles = getSampleNews();
//     }
    
//     await ingestArticles(articles);
    
//     console.log('\n✨ Ingestion complete!');
//     console.log(`📊 Total articles: ${articles.length}`);
    
//     console.log('\n🔍 Testing search...');
//     const testQuery = articles[0].text;
//     const testEmbedding = (await getEmbeddings([testQuery]))[0];
    
//     const results = await qdrant.search(COLLECTION_NAME, {
//       vector: testEmbedding,
//       limit: 3
//     });
    
//     console.log(`✅ Search test successful. Found ${results.length} results`);
    
//     process.exit(0);
//   } catch (err) {
//     console.error('\n❌ Ingestion failed:', err);
//     process.exit(1);
//   }
// }

// main();

// ingest.js
import { QdrantClient } from '@qdrant/qdrant-js';
import axios from 'axios';
import dotenv from 'dotenv';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';

dotenv.config();

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  https: true
});

const COLLECTION_NAME = 'news';
const EMBEDDING_DIMENSION = 1024;

async function getEmbeddings(texts) {
  const res = await axios.post(
    'https://api.jina.ai/v1/embeddings',
    { input: texts, model: 'jina-embeddings-v3', task: 'text-matching' },
    { headers: { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` } }
  );
  return res.data.data.map(d => d.embedding);
}

async function scrapeArticle(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    const $ = cheerio.load(data);

    // BBC-specific: remove scripts, nav, ads
    $('script, style, nav, footer, header, aside').remove();
    const text = $('article, .story-body, p').text().trim();
    return text.slice(0, 8000); // limit size
  } catch (err) {
    console.warn(`Failed to scrape ${url}:`, err.message);
    return '';
  }
}

async function fetchNewsFromRSS() {
  const rssUrl = 'http://feeds.bbci.co.uk/news/rss.xml';
  const { data } = await axios.get(rssUrl);
  const parsed = await parseStringPromise(data);
  const items = parsed.rss.channel[0].item.slice(0, 50);

  console.log(`Found ${items.length} RSS items. Scraping full articles...`);

  const articles = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const link = item.link?.[0];
    const fullText = link ? await scrapeArticle(link) : '';

    articles.push({
      id: i + 1,
      title: item.title?.[0] || 'No title',
      description: item.description?.[0] || '',
      link: link || '',
      pubDate: item.pubDate?.[0] || '',
      text: fullText || item.description?.[0] || item.title?.[0]
    });

    process.stdout.write(`\rScraped: ${i + 1}/${items.length}`);
  }
  console.log('\nScraping complete.');
  return articles;
}

async function createCollection() {
  const collections = await qdrant.getCollections();
  if (!collections.collections.some(c => c.name === COLLECTION_NAME)) {
    console.log(`Creating collection '${COLLECTION_NAME}'...`);
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' }
    });
  }
}

async function ingestArticles(articles) {
  const texts = articles.map(a => a.text);
  const embeddings = await getEmbeddings(texts);

  const points = articles.map((a, i) => ({
    id: a.id,
    vector: embeddings[i],
    payload: {
      title: a.title,
      text: a.text,
      link: a.link,
      pubDate: a.pubDate,
      summary: a.text.slice(0, 300) + '...'
    }
  }));

  await qdrant.upsert(COLLECTION_NAME, { points, wait: true });
  console.log(`Ingested ${articles.length} full articles into Qdrant`);
}

async function main() {
  console.log('Starting full-article ingestion pipeline...\n');
  await createCollection();
  const articles = await fetchNewsFromRSS();
  await ingestArticles(articles);
  console.log('\nIngestion complete! Ready for RAG queries.');
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});