/**
 * Test script for new paper embedding system
 * Run with: npx tsx test-embedding.ts
 */

import { getPrismaClient } from './src/db/client';
import { PapersRepository, PaperEmbeddingRepository } from './src/db';
import * as paperEmbeddingService from './src/main/services/paper-embedding.service';
import * as vecIndex from './src/main/services/vec-index.service';
import * as semanticSearch from './src/main/services/semantic-search.service';

async function main() {
  console.log('=== Testing Paper Embedding System ===\n');

  // Initialize
  const prisma = getPrismaClient();
  const papersRepo = new PapersRepository();
  const embeddingRepo = new PaperEmbeddingRepository();

  // Get stats
  const stats = await paperEmbeddingService.getEmbeddingStats();
  console.log('📊 Current Stats:');
  console.log(`  Total papers: ${stats.totalPapers}`);
  console.log(`  Papers with embeddings: ${stats.papersWithEmbeddings}`);
  console.log(`  Papers without embeddings: ${stats.papersWithoutEmbeddings}\n`);

  // Test 1: Generate embeddings for a paper
  console.log('🧪 Test 1: Generate embeddings for a paper');
  const papers = await papersRepo.list({ limit: 1 });
  if (papers.length === 0) {
    console.log('  ❌ No papers found in database');
    return;
  }

  const testPaper = papers[0];
  console.log(`  Paper: "${testPaper.title}"`);

  try {
    await paperEmbeddingService.generateEmbeddings(testPaper.id);
    console.log('  ✅ Embeddings generated successfully\n');
  } catch (error) {
    console.log(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return;
  }

  // Test 2: Verify embeddings were stored
  console.log('🧪 Test 2: Verify embeddings in database');
  const embedding = await embeddingRepo.findByPaperId(testPaper.id);
  if (embedding) {
    console.log('  ✅ Embeddings found in database');
    console.log(`     Title embedding: ${embedding.titleEmbedding ? 'Yes' : 'No'}`);
    console.log(`     Abstract embedding: ${embedding.abstractEmbedding ? 'Yes' : 'No'}\n`);
  } else {
    console.log('  ❌ Embeddings not found in database\n');
    return;
  }

  // Test 3: Initialize vector index
  console.log('🧪 Test 3: Initialize vector index');
  try {
    await vecIndex.initialize();
    const status = vecIndex.getStatus();
    console.log(`  ✅ Vector index initialized`);
    console.log(`     Count: ${status.count}`);
    console.log(`     Dimension: ${status.dimension}`);
    console.log(`     Model: ${status.model}\n`);
  } catch (error) {
    console.log(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return;
  }

  // Test 4: Semantic search
  console.log('🧪 Test 4: Semantic search');
  const query = testPaper.title.split(' ').slice(0, 3).join(' '); // Use first 3 words
  console.log(`  Query: "${query}"`);

  try {
    const searchService = new semanticSearch.SemanticSearchService();
    const results = await searchService.search(query, 5);
    console.log(`  ✅ Search completed`);
    console.log(`     Mode: ${results.mode}`);
    console.log(`     Results: ${results.papers.length}`);

    if (results.papers.length > 0) {
      console.log('\n  Top result:');
      const top = results.papers[0];
      console.log(`     Title: "${top.title}"`);
      console.log(`     Similarity: ${top.similarityScore.toFixed(3)}`);
      console.log(`     Final score: ${top.finalScore.toFixed(3)}`);
      console.log(`     Match type: ${top.matchType}`);
    }
  } catch (error) {
    console.log(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\n=== Test Complete ===');
  await prisma.$disconnect();
}

main().catch(console.error);
