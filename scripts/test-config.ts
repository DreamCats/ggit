#!/usr/bin/env bun

/**
 * LLM配置测试脚本
 * 用于验证配置设置和获取功能是否正常工作
 */

import { setLLMConfig, initLLMService } from '../src/core/nlp/llm-service.ts';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.gt-nl', 'config.json');

async function main() {
  console.log('开始测试LLM配置功能...');
  
  // 测试配置保存
  console.log('测试1: 设置配置...');
  const testConfig = {
    apiKey: 'test-api-key-12345',
    model: 'test-model',
    baseUrl: 'http://test-url.com'
  };
  
  try {
    await setLLMConfig(testConfig);
    console.log('✅ 配置设置成功');
    
    // 测试配置读取
    console.log('\n测试2: 读取配置文件...');
    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const savedConfig = JSON.parse(configData);
    
    console.log('读取到的配置:');
    console.log(savedConfig);
    
    // 验证配置正确性
    const isValid = 
      savedConfig.apiKey === testConfig.apiKey &&
      savedConfig.model === testConfig.model &&
      savedConfig.baseUrl === testConfig.baseUrl;
    
    if (isValid) {
      console.log('✅ 配置保存和读取一致');
    } else {
      console.log('❌ 配置不一致!');
      console.log('预期:', testConfig);
      console.log('实际:', savedConfig);
    }
    
    // 测试初始化服务
    console.log('\n测试3: 初始化LLM服务...');
    const initialized = await initLLMService();
    
    if (initialized) {
      console.log('✅ LLM服务初始化成功');
    } else {
      console.log('❌ LLM服务初始化失败!');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
  
  console.log('\n所有测试完成!');
}

main(); 