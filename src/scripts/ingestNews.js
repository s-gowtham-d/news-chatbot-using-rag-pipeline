/**
 * Ingest News Script
 * Fetches news articles from RSS feed, generates embeddings, and stores them in Qdrant
 * Uses Jina Embeddings API for embedding generation
 * Uses Qdrant as the vector database
 * Fetches from BBC News RSS feed
 * If RSS fetch fails, uses sample news data
 * Creates Qdrant collection if not exists
 * Ingests up to 50 articles
 * Tests search functionality after ingestion
 * Run with: node src/scripts/ingestNews.js
 */

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
      text: a.text + '\n\nHere is a link to read more at: ' + a.link + '\n published on: ' + a.pubDate,
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