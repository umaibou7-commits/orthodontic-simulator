// src/App.jsx - 動作する完全版（差し替え用）
import React, { useMemo, useState } from "react";
import {
  ChevronRight,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const CLINICAL_DATABASE = {
  casePatterns: {
    "歯並びのガタガタ": {
      medicalTerm: "叢生（そうせい）",
      severity: {
        mild: { spacing: "<3mm", treatment: "マウスピース矯正", duration: "12-18", cost: "60-80" },
        moderate: { spacing: "3-6mm", treatment: "マウスピース矯正 or ワイヤー矯正", duration: "18-24", cost: "70-100" },
        severe: { spacing: ">6mm", treatment: "ワイヤー矯正（抜歯の可能性）", duration: "24-36", cost: "80-120" },
      },
    },
    "出っ歯": {
      medicalTerm: "上顎前突",
      severity: {
        mild: { protrusion: "<4mm", treatment: "マウスピース矯正", duration: "18-24", cost: "70-90" },
        moderate: { protrusion: "4-7mm", treatment: "ワイヤー矯正", duration: "24-30", cost: "80-110" },
        severe: { protrusion: ">7mm", treatment: "ワイヤー矯正（抜歯必須）", duration: "30-36", cost: "90-130" },
      },
    },
    "受け口": {
      medicalTerm: "下顎前突・反対咬合",
      severity: {
        mild: { gap: "<2mm", treatment: "マウスピース矯正", duration: "18-24", cost: "70-100" },
        moderate: { gap: "2-5mm", treatment: "ワイヤー矯正", duration: "24-36", cost: "80-120" },
        severe: { gap: ">5mm", treatment: "ワイヤー矯正 + 外科矯正", duration: "36-48", cost: "100-150" },
      },
    },
    "すきっ歯": {
      medicalTerm: "空隙歯列",
      severity: {
        mild: { gaps: "1-2箇所", treatment: "マウスピース矯正", duration: "6-12", cost: "40-60" },
        moderate: { gaps: "3-4箇所", treatment: "マウスピース矯正", duration: "12-18", cost: "60-80" },
        severe: { gaps: "5箇所以上", treatment: "ワイヤー矯正", duration: "18-24", cost: "70-100" },
      },
    },
  },
  lifestyleFactors: {
    "人と話す機会が多い": {
      recommended: "マウスピース矯正",
      reason: "目立ちにくく、発音への影響が少ない",
      considerations: "装着時間の厳守が必要（1日20-22時間）",
    },
    "デスクワーク中心": {
      recommended: "マウスピース矯正 or ワイヤー矯正",
      reason: "見た目の制約が少なく、どちらも選択可能",
      considerations: "通院スケジュールの調整がしやすい",
    },
    "接客業": {
      recommended: "マウスピース矯正 or 裏側矯正",
      reason: "見た目への配慮が最優先",
      considerations: "コスト面で裏側矯正は高額（150-180万円）",
    },
    学生: {
      recommended: "ワイヤー矯正 or マウスピース矯正",
      reason: "費用対効果と治療期間のバランス",
      considerations: "部活動や学校行事との調整が必要",
    },
  },
  budgetMatrix: {
    "50万円以下": {
      options: ["部分矯正（マウスピース）", "部分矯正（ワイヤー）"],
      limitations: "全顎矯正は困難。前歯部のみの治療が中心",
      duration: "6-12ヶ月",
    },
    "50〜70万円": {
      options: ["マウスピース矯正（軽度〜中度）", "ワイヤー矯正（軽度）"],
      limitations: "重度の症例は追加費用の可能性",
      duration: "12-24ヶ月",
    },
    "70〜100万円": {
      options: ["マウスピース矯正（全顎）", "ワイヤー矯正（全顎）"],
      limitations: "ほぼすべての症例に対応可能",
      duration: "18-36ヶ月",
    },
    "100万円以上": {
      options: ["裏側矯正", "ハイブリッド矯正", "外科矯正併用"],
      limitations: "制限なし。審美性重視の選択も可能",
      duration: "症例による",
    },
  },
};

// 多少壊れたJSONが返っても「最初の { ... }」を抜き出してパースする
function safeJsonParse(maybeJsonText) {
  if (!maybeJsonText) return null;
  const cleaned = String(maybeJsonText).replace(/```json\s*|\s*```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function analyzeWithGemini(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "AIzaSyC4ktBCftxN3IzEYwevP5LAfWnWDpeZ0Dk") {
    console.warn("Gemini APIキー未設定 - フォールバックモード");
    return null;
  }

  try {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const response = await fetch(`${endpoint}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
}

export default function OrthodonticSimulator() {
  const [step, setStep] = useState("intro");
  const [formData, setFormData] = useState({
    concern: "",
    lifestyle: "",
    priority: "",
    name: "",
    phone: "",
    email: "",
    age: "",
    occupation: "",
    availability: "",
    budget: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const canRunAnonymous = !!formData.concern && !!formData.lifestyle && !!formData.priority;
  const canRunDetailed = !!formData.name && !!formData.age && !!formData.phone;

  const severityLabel = useMemo(() => {
    if (!result?.severity) return "";
    return result.severity === "mild" ? "軽度" : result.severity === "moderate" ? "中度" : "重度";
  }, [result]);

  const handleAnonymousSubmit = async () => {
    if (!canRunAnonymous) return;

    setLoading(true);

    const caseData = CLINICAL_DATABASE.casePatterns[formData.concern];
    const lifestyleData = CLINICAL_DATABASE.lifestyleFactors[formData.lifestyle];

    const prompt = `患者情報:
- 悩み: ${formData.concern}
- ライフスタイル: ${formData.lifestyle}
- 優先順位: ${formData.priority}

症例データ（治療法候補）:
${Object.entries(caseData.severity)
  .map(([s, d]) => `- ${s}: 治療=${d.treatment}, 期間=${d.duration}ヶ月, 費用=${d.cost}万円`)
  .join("\n")}

ライフスタイル推奨:
- 推奨: ${lifestyleData.recommended}
- 理由: ${lifestyleData.reason}

出力はJSONのみ（説明文なし）:
{"recommendedTreatment":"治療法","estimatedDuration":"期間(例:18-24)","estimatedCost":"費用(例:70-100)","severity":"mild/moderate/severe","reasoning":"理由100文字以内","considerations":"注意点100文字以内"}`;

    try {
      const aiResponse = await analyzeWithGemini(prompt);
      const aiResult = safeJsonParse(aiResponse);

      if (!aiResult) throw new Error("AI JSON parse failed");

      setResult({
        ...aiResult,
        lifestyleMatch: lifestyleData,
        clinicalData: caseData,
      });
    } catch (error) {
      // フォールバック（AI無しでも動く）
      const fallbackSeverity = "moderate";
      setResult({
        recommendedTreatment: lifestyleData.recommended,
        estimatedDuration: caseData.severity[fallbackSeverity].duration,
        estimatedCost: caseData.severity[fallbackSeverity].cost,
        severity: fallbackSeverity,
        reasoning: lifestyleData.reason,
        considerations: lifestyleData.considerations,
        lifestyleMatch: lifestyleData,
        clinicalData: caseData,
      });
    } finally {
      setLoading(false);
      setStep("result-anonymous");
    }
  };

  const handleDetailedSubmit = async () => {
    if (!canRunDetailed || !result) return;

    setLoading(true);

    const budgetKey = formData.budget || "70〜100万円";
    const budgetData = CLINICAL_DATABASE.budgetMatrix[budgetKey] ?? CLINICAL_DATABASE.budgetMatrix["70〜100万円"];

    const prompt = `詳細診断:
- 年齢: ${formData.age}歳
- 職業: ${formData.occupation || "未回答"}
- 予算: ${budgetKey}
- 通院: ${formData.availability || "未回答"}

初期診断:
- 推奨: ${result.recommendedTreatment}
- 期間: ${result.estimatedDuration}ヶ月
- 費用: ${result.estimatedCost}万円

予算レンジの制約:
- 選択肢: ${budgetData.options.join(", ")}
- 注意: ${budgetData.limitations}

出力はJSONのみ（説明文なし）:
{"finalTreatment":"治療法","detailedDuration":"数値(ヶ月)","totalCost":"数値(万円)","monthlyVisits":"数値(総通院回数)","lifestyleImpact":{"speech":"低/中/高","eating":"低/中/高","appearance":"低/中/高"},"compatibility":"0-100数値"}`;

    try {
      const aiResponse = await analyzeWithGemini(prompt);
      const detailed = safeJsonParse(aiResponse);
      if (!detailed) throw new Error("AI detailed JSON parse failed");

      setResult((prev) => ({
        ...prev,
        ...detailed,
      }));
    } catch (error) {
      // フォールバック（簡易スコアリング）
      const budgetScore = budgetKey === "100万円以上" ? 5 : budgetKey === "70〜100万円" ? 4 : 3;
      const timeScore = formData.availability === "平日・土日とも可" ? 5 : formData.availability ? 4 : 3;

      // 期間・費用は匿名結果から “だいたい” を1つに寄せる
      const durationMid = String(result.estimatedDuration || "18-24").includes("-") ? "24" : String(result.estimatedDuration || "24");
      const costMid = String(result.estimatedCost || "70-100").includes("-") ? "85" : String(result.estimatedCost || "85");

      setResult((prev) => ({
        ...prev,
        finalTreatment: prev.recommendedTreatment,
        detailedDuration: durationMid,
        totalCost: costMid,
        monthlyVisits: 12, // 総通院回数の目安
        lifestyleImpact: { speech: "低", eating: "低", appearance: "低" },
        compatibility: Math.round(((budgetScore + timeScore) / 2) * 20),
      }));
    } finally {
      setLoading(false);
      setStep("result-detailed");
    }
  };

  const resetAll = () => {
    setStep("intro");
    setFormData({
      concern: "",
      lifestyle: "",
      priority: "",
      name: "",
      phone: "",
      email: "",
      age: "",
      occupation: "",
      availability: "",
      budget: "",
    });
    setResult(null);
  };

  // ---------------------------
  // 共通：ローディング
  // ---------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">AI診断中...</h3>
          <p className="text-gray-600">最適な治療プランを分析しています</p>
        </div>
      </div>
    );
  }

  // ---------------------------
  // STEP: intro
  // ---------------------------
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <div className="inline-block bg-blue-600 text-white px-6 py-2 rounded-full text-sm font-medium mb-4">
              AI搭載・臨床データベース活用
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">矯正治療シミュレーター</h1>
            <p className="text-lg text-gray-600 mb-2">Google Gemini AIによる精密診断</p>
            <p className="text-sm text-gray-500">3分でわかる、あなたに最適な矯正治療プラン</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center p-6 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">AI診断</h3>
                <p className="text-sm text-gray-600">Gemini APIで精密分析</p>
              </div>
              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">臨床データ</h3>
                <p className="text-sm text-gray-600">実際の症例に基づく</p>
              </div>
              <div className="text-center p-6 bg-green-50 rounded-xl">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">完全無料</h3>
                <p className="text-sm text-gray-600">費用は一切不要</p>
              </div>
            </div>

            <button
              onClick={() => setStep("anonymous-check")}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              無料AI診断を始める
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // STEP: anonymous-check
  // ---------------------------
  if (step === "anonymous-check") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <button onClick={() => setStep("intro")} className="text-blue-600 hover:text-blue-700 mb-4">
              ← 戻る
            </button>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">AI診断 ステップ1</h2>
            <p className="text-gray-600">あなたの悩みを教えてください</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">主な悩み</label>
              <div className="space-y-2">
                {Object.keys(CLINICAL_DATABASE.casePatterns).map((concern) => (
                  <button
                    key={concern}
                    onClick={() => setFormData((p) => ({ ...p, concern }))}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      formData.concern === concern
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="font-semibold">{concern}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {CLINICAL_DATABASE.casePatterns[concern].medicalTerm}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">ライフスタイル</label>
              <div className="space-y-2">
                {Object.keys(CLINICAL_DATABASE.lifestyleFactors).map((lifestyle) => (
                  <button
                    key={lifestyle}
                    onClick={() => setFormData((p) => ({ ...p, lifestyle }))}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      formData.lifestyle === lifestyle
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {lifestyle}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">最優先したいこと</label>
              <div className="space-y-2">
                {["目立ちにくさ", "費用の安さ", "治療期間の短さ", "確実な効果"].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => setFormData((p) => ({ ...p, priority }))}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      formData.priority === priority
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAnonymousSubmit}
              disabled={!canRunAnonymous}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              AI診断を実行
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // STEP: result-anonymous
  // ---------------------------
  if (step === "result-anonymous" && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8 text-center">
            <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
              AI診断完了
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">あなたに最適な治療法（概算）</h2>
            <p className="text-gray-600">※最終確定は来院での診断が必要です</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="text-center mb-6">
              <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl text-2xl font-bold mb-3">
                {result.recommendedTreatment}
              </div>
              <p className="text-gray-600">がおすすめです</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">理由（要約）</h4>
              <p className="text-sm text-gray-700">{result.reasoning}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <Calendar className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{result.estimatedDuration}</div>
                <div className="text-sm text-gray-600">ヶ月（目安）</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl text-center">
                <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{result.estimatedCost}</div>
                <div className="text-sm text-gray-600">万円（目安）</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-gray-900">{severityLabel}</div>
                <div className="text-sm text-gray-600">症例レベル</div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
              <h4 className="font-semibold text-amber-900 mb-2">注意事項</h4>
              <p className="text-sm text-amber-800">{result.considerations}</p>
            </div>

            <button
              onClick={() => setStep("personal-info")}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              詳細AI診断を受ける
              <ChevronRight className="w-5 h-5" />
            </button>

            <button onClick={resetAll} className="w-full mt-4 text-gray-600 hover:text-gray-900 font-medium">
              最初からやり直す
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // STEP: personal-info
  // ---------------------------
  if (step === "personal-info") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <button onClick={() => setStep("result-anonymous")} className="text-blue-600 hover:text-blue-700 mb-4">
              ← 戻る
            </button>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">AI診断 ステップ2</h2>
            <p className="text-gray-600">より正確な診断のための情報入力</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  年齢 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData((p) => ({ ...p, age: e.target.value }))}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
                  placeholder="25"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                電話番号 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
                placeholder="090-1234-5678"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">メール（任意）</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
                placeholder="example@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">職業</label>
              <select
                value={formData.occupation}
                onChange={(e) => setFormData((p) => ({ ...p, occupation: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
              >
                <option value="">選択してください</option>
                <option value="営業職">営業職</option>
                <option value="事務職">事務職</option>
                <option value="接客業">接客業</option>
                <option value="学生">学生</option>
                <option value="その他">その他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">通院可能な時間帯</label>
              <select
                value={formData.availability}
                onChange={(e) => setFormData((p) => ({ ...p, availability: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
              >
                <option value="">選択してください</option>
                <option value="平日・土日とも可">平日・土日とも可</option>
                <option value="平日のみ">平日のみ</option>
                <option value="土日のみ">土日のみ</option>
                <option value="平日19時以降・土日">平日19時以降・土日</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">ご予算</label>
              <select
                value={formData.budget}
                onChange={(e) => setFormData((p) => ({ ...p, budget: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none"
              >
                <option value="">選択してください</option>
                {Object.keys(CLINICAL_DATABASE.budgetMatrix).map((budget) => (
                  <option key={budget} value={budget}>
                    {budget}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDetailedSubmit}
              disabled={!canRunDetailed}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              詳細AI診断を実行
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // STEP: result-detailed
  // ---------------------------
  if (step === "result-detailed" && result) {
    const impact = result.lifestyleImpact || { speech: "中", eating: "中", appearance: "中" };
    const widths = { 低: "25%", 中: "55%", 高: "85%" };
    const labels = { speech: "発話", eating: "食事", appearance: "見た目" };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="mb-8 text-center">
            <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-medium mb-4">
              {formData.name} 様専用 AI診断結果
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">詳細シミュレーション</h2>
            <p className="text-gray-600">※最終確定は来院での診断が必要です</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">あなたの最適治療プラン</h3>
                <p className="text-gray-600 text-sm mt-1">
                  ステップ1の結果（{result.recommendedTreatment}）を、予算・通院条件で最適化
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">適合度</div>
                <div className="text-3xl font-bold text-gray-900">{result.compatibility ?? 0}%</div>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-lg font-bold text-gray-900">{result.finalTreatment || result.recommendedTreatment}</div>
                <div className="text-sm text-gray-600">最終推奨</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl text-center">
                <Calendar className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{result.detailedDuration ?? "24"}</div>
                <div className="text-sm text-gray-600">ヶ月（想定）</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{result.totalCost ?? "85"}</div>
                <div className="text-sm text-gray-600">万円（総額目安）</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl text-center">
                <Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{result.monthlyVisits ?? 12}</div>
                <div className="text-sm text-gray-600">回（総通院目安）</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">生活への影響度（目安）</h4>
              <div className="space-y-4">
                {Object.keys(labels).map((k) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-700">{labels[k]}への影響</span>
                      <span className="font-semibold text-gray-900">{impact[k] || "中"}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: widths[impact[k] || "中"] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-amber-900 mb-2">来院で確定が必要な項目</h4>
                  <p className="text-sm text-amber-800">
                    レントゲン撮影や医師の診察が必要なため、Webでは判定できません
                  </p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">抜歯の必要性</span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">
                      要確認 ?
                    </span>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">マウスピース適応可否</span>
                    <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">
                      要確認 ?
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4 text-center">無料初診カウンセリングのご予約</h3>
            <p className="text-center mb-6 text-blue-100">
              詳しい治療計画は、実際にお口の中を拝見してからご提案させていただきます
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <CheckCircle className="w-6 h-6 mb-2" />
                <div className="font-semibold mb-1">所要時間 60分</div>
                <div className="text-sm text-blue-100">じっくりご相談</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <CheckCircle className="w-6 h-6 mb-2" />
                <div className="font-semibold mb-1">完全無料</div>
                <div className="text-sm text-blue-100">費用不要</div>
              </div>
            </div>

            {/* ここは実運用に合わせてリンクに差し替え */}
            <button
              onClick={() => alert("予約導線（リンク）を設定してください")}
              className="w-full bg-white text-blue-600 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all"
            >
              今すぐ予約する
            </button>
          </div>

          <div className="text-center mt-8">
            <button onClick={resetAll} className="text-gray-600 hover:text-gray-900 font-medium">
              最初からやり直す
            </button>
          </div>
        </div>
      </div>
    );
  }

  // フォールバック（想定外ステップ）
  return null;
}
