// src/App.jsx
import React, { useState } from 'react';
import { ChevronRight, Upload, Calendar, DollarSign, Clock, AlertCircle, CheckCircle, Camera, Loader2 } from 'lucide-react';

// 環境変数からAPIキーを取得（Vercel環境変数で設定）
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// 臨床データベース
const CLINICAL_DATABASE = {
  casePatterns: {
    '歯並びのガタガタ': {
      medicalTerm: '叢生（そうせい）',
      severity: {
        mild: { spacing: '<3mm', treatment: 'マウスピース矯正', duration: '12-18', cost: '60-80' },
        moderate: { spacing: '3-6mm', treatment: 'マウスピース矯正 or ワイヤー矯正', duration: '18-24', cost: '70-100' },
        severe: { spacing: '>6mm', treatment: 'ワイヤー矯正（抜歯の可能性）', duration: '24-36', cost: '80-120' }
      }
    },
    '出っ歯': {
      medicalTerm: '上顎前突',
      severity: {
        mild: { protrusion: '<4mm', treatment: 'マウスピース矯正', duration: '18-24', cost: '70-90' },
        moderate: { protrusion: '4-7mm', treatment: 'ワイヤー矯正', duration: '24-30', cost: '80-110' },
        severe: { protrusion: '>7mm', treatment: 'ワイヤー矯正（抜歯必須）', duration: '30-36', cost: '90-130' }
      }
    },
    '受け口': {
      medicalTerm: '下顎前突・反対咬合',
      severity: {
        mild: { gap: '<2mm', treatment: 'マウスピース矯正', duration: '18-24', cost: '70-100' },
        moderate: { gap: '2-5mm', treatment: 'ワイヤー矯正', duration: '24-36', cost: '80-120' },
        severe: { gap: '>5mm', treatment: 'ワイヤー矯正 + 外科矯正', duration: '36-48', cost: '100-150' }
      }
    },
    'すきっ歯': {
      medicalTerm: '空隙歯列',
      severity: {
        mild: { gaps: '1-2箇所', treatment: 'マウスピース矯正', duration: '6-12', cost: '40-60' },
        moderate: { gaps: '3-4箇所', treatment: 'マウスピース矯正', duration: '12-18', cost: '60-80' },
        severe: { gaps: '5箇所以上', treatment: 'ワイヤー矯正', duration: '18-24', cost: '70-100' }
      }
    }
  },

  lifestyleFactors: {
    '人と話す機会が多い': {
      recommended: 'マウスピース矯正',
      reason: '目立ちにくく、発音への影響が少ない',
      considerations: '装着時間の厳守が必要（1日20-22時間）'
    },
    'デスクワーク中心': {
      recommended: 'マウスピース矯正 or ワイヤー矯正',
      reason: '見た目の制約が少なく、どちらも選択可能',
      considerations: '通院スケジュールの調整がしやすい'
    },
    '接客業': {
      recommended: 'マウスピース矯正 or 裏側矯正',
      reason: '見た目への配慮が最優先',
      considerations: 'コスト面で裏側矯正は高額（150-180万円）'
    },
    '学生': {
      recommended: 'ワイヤー矯正 or マウスピース矯正',
      reason: '費用対効果と治療期間のバランス',
      considerations: '部活動や学校行事との調整が必要'
    }
  },

  budgetMatrix: {
    '50万円以下': {
      options: ['部分矯正（マウスピース）', '部分矯正（ワイヤー）'],
      limitations: '全顎矯正は困難。前歯部のみの治療が中心',
      duration: '6-12ヶ月'
    },
    '50〜70万円': {
      options: ['マウスピース矯正（軽度〜中度）', 'ワイヤー矯正（軽度）'],
      limitations: '重度の症例は追加費用の可能性',
      duration: '12-24ヶ月'
    },
    '70〜100万円': {
      options: ['マウスピース矯正（全顎）', 'ワイヤー矯正（全顎）'],
      limitations: 'ほぼすべての症例に対応可能',
      duration: '18-36ヶ月'
    },
    '100万円以上': {
      options: ['裏側矯正', 'ハイブリッド矯正', '外科矯正併用'],
      limitations: '制限なし。審美性重視の選択も可能',
      duration: '症例による'
    }
  }
};

// Gemini API呼び出し（エラーハンドリング強化版）
async function analyzeWithGemini(prompt, imageData = null) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyC4ktBCftxN3IzEYwevP5LAfWnWDpeZ0Dk') {
    console.error('Gemini APIキーが設定されていません');
    return null;
  }
  
  try {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
    let body;
    if (imageData) {
      body = {
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageData.split(',')[1]
              }
            }
          ]
        }]
      };
    } else {
      body = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };
    }

    const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Gemini API呼び出しエラー:', error);
    return null;
  }
}

export default function OrthodonticSimulator() {
  const [step, setStep] = useState('intro');
  const [formData, setFormData] = useState({
    concern: '', lifestyle: '', priority: '',
    name: '', phone: '', email: '', age: '',
    occupation: '', availability: '', budget: '',
    photoUploaded: false, photoData: null
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // 匿名診断の実行
  const handleAnonymousSubmit = async () => {
    setLoading(true);
    
    const caseData = CLINICAL_DATABASE.casePatterns[formData.concern];
    const lifestyleData = CLINICAL_DATABASE.lifestyleFactors[formData.lifestyle];
    
    const prompt = `
あなたは経験豊富な矯正歯科医です。以下の患者情報から最適な治療計画を提案してください。

【患者情報】
- 主訴: ${formData.concern} (${caseData.medicalTerm})
- ライフスタイル: ${formData.lifestyle}
- 優先事項: ${formData.priority}

【利用可能な治療法】
${Object.entries(caseData.severity).map(([severity, data]) => 
  `- ${severity}: ${data.treatment} (期間: ${data.duration}ヶ月, 費用: ${data.cost}万円)`
).join('\n')}

【ライフスタイル考慮事項】
- 推奨: ${lifestyleData.recommended}
- 理由: ${lifestyleData.reason}

以下のJSON形式で回答してください（JSONのみ、他の文章は不要）:
{
  "recommendedTreatment": "推奨治療法",
  "estimatedDuration": "治療期間（ヶ月）",
  "estimatedCost": "費用（万円）",
  "severity": "mild/moderate/severe",
  "reasoning": "推奨理由（100文字以内）",
  "considerations": "注意点（100文字以内）"
}
`;

    try {
      const aiResponse = await analyzeWithGemini(prompt);
      
      if (aiResponse) {
        const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        const aiResult = JSON.parse(cleanedResponse);
        
        setResult({
          ...aiResult,
          lifestyleMatch: lifestyleData,
          clinicalData: caseData
        });
      } else {
        // APIエラー時のフォールバック
        throw new Error('AI診断に失敗');
      }
    } catch (error) {
      console.error('診断エラー:', error);
      // 臨床データベースのみで診断
      setResult({
        recommendedTreatment: lifestyleData.recommended,
        estimatedDuration: caseData.severity.moderate.duration,
        estimatedCost: caseData.severity.moderate.cost,
        severity: 'moderate',
        reasoning: lifestyleData.reason,
        considerations: lifestyleData.considerations,
        lifestyleMatch: lifestyleData,
        clinicalData: caseData
      });
    }
    
    setLoading(false);
    setStep('result-anonymous');
  };

  // 詳細診断の実行
  const handleDetailedSubmit = async () => {
    setLoading(true);
    
    const budgetData = CLINICAL_DATABASE.budgetMatrix[formData.budget];
    
    const prompt = `
【詳細患者プロファイル】
基本情報:
- 年齢: ${formData.age}歳
- 職業: ${formData.occupation}
- 主訴: ${formData.concern}
- 予算: ${formData.budget}
- 通院可能時間: ${formData.availability}

初期診断結果:
- 推奨治療: ${result.recommendedTreatment}
- 想定期間: ${result.estimatedDuration}ヶ月
- 想定費用: ${result.estimatedCost}万円

予算制約:
- 選択肢: ${budgetData.options.join(', ')}
- 制限事項: ${budgetData.limitations}

この患者に最適化された治療計画を、以下のJSON形式で提案してください（JSONのみ）:
{
  "finalTreatment": "最終推奨治療法",
  "detailedDuration": "詳細期間（数値のみ）",
  "totalCost": "総費用（数値のみ）",
  "monthlyVisits": "総通院回数（数値のみ）",
  "lifestyleImpact": {
    "speech": "低/中/高",
    "eating": "低/中/高",
    "appearance": "低/中/高"
  },
  "compatibility": "適合度スコア（0-100の数値）",
  "timeline": "治療の流れ（3ステップ）",
  "risks": "リスク・注意点"
}
`;

    try {
      const aiResponse = await analyzeWithGemini(prompt);
      
      if (aiResponse) {
        const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
        const detailedResult = JSON.parse(cleanedResponse);
        
        setResult({
          ...result,
          ...detailedResult,
          needsExtraction: '要確認（レントゲン診断）',
          suitableForInvisalign: '要確認（口腔内検査）'
        });
      } else {
        throw new Error('詳細診断に失敗');
      }
    } catch (error) {
      console.error('詳細診断エラー:', error);
      // フォールバック処理
      const budgetScore = formData.budget === '100万円以上' ? 5 : formData.budget === '70〜100万円' ? 4 : 3;
      const timeScore = formData.availability === '平日・土日とも可' ? 5 : 4;
      
      setResult({
        ...result,
        finalTreatment: result.recommendedTreatment,
        detailedDuration: result.estimatedDuration.split('-')[1] || '24',
        totalCost: result.estimatedCost.split('-')[1] || '85',
        monthlyVisits: 15,
        lifestyleImpact: {
          speech: formData.occupation?.includes('営業') ? '中' : '低',
          eating: '低',
          appearance: formData.priority === '目立ちにくさ' ? '低' : '中'
        },
        compatibility: Math.round((budgetScore + timeScore) / 2 * 20),
        needsExtraction: '要確認',
        suitableForInvisalign: '要確認'
      });
    }
    
    setLoading(false);
    setStep('result-detailed');
  };

  // ローディング画面
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">AI診断中...</h3>
          <p className="text-gray-600">Gemini AIが最適な治療プランを分析しています</p>
        </div>
      </div>
    );
  }

  // 以下、各ステップのUIは前回と同じなので省略（前回のコードを使用）
  // intro, anonymous-check, result-anonymous, personal-info, result-detailedの各画面

  // イントロ画面のみ例として記載:
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* イントロ画面の内容 */}
          {/* 前回作成した内容をここに配置 */}
        </div>
      </div>
    );
  }

  // 他のステップも同様に実装...
  return null;
}
