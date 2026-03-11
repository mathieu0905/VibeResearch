export const paperReadingTemplate = {
  sections: [
    'Research Problem',
    'Core Method',
    'Key Results',
    'Strengths',
    'Weaknesses',
    'Reproducibility Notes',
    'Follow-up Questions',
  ],
};

export const codeReadingTemplate = {
  sections: [
    'Repository Goal',
    'Architecture Summary',
    'Critical Modules',
    'Execution Path',
    'Potential Risks',
    'Optimization Opportunities',
  ],
};

const paperReadingTemplateZh = {
  sections: ['研究问题', '核心方法', '主要结果', '优势', '局限性', '可复现性说明', '后续问题'],
};

const codeReadingTemplateZh = {
  sections: ['仓库目标', '架构摘要', '关键模块', '执行路径', '潜在风险', '优化机会'],
};

export function getPaperReadingTemplate(language: 'en' | 'zh' = 'en') {
  return language === 'zh' ? paperReadingTemplateZh : paperReadingTemplate;
}

export function getCodeReadingTemplate(language: 'en' | 'zh' = 'en') {
  return language === 'zh' ? codeReadingTemplateZh : codeReadingTemplate;
}
