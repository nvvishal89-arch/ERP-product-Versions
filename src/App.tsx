/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Plus, 
  Search, 
  Image as ImageIcon, 
  Layers, 
  Loader2, 
  ChevronRight, 
  ArrowLeft,
  Globe,
  Sparkles,
  Database,
  Trash2,
  CheckCircle,
  FileCode,
  Settings,
  History,
  Layout,
  Maximize2,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  Info,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import DxfParser from 'dxf-parser';
import { DxfGenerator } from './utils/dxfGenerator';
import { Type } from "@google/genai";

// Types
interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface Product {
  id: number;
  name: string;
  image_data: string;
  created_at: string;
}

interface ProductView {
  id: number;
  product_id: number;
  view_type: string;
  image_url: string;
  source: string;
  metadata?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [views, setViews] = useState<ProductView[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [isGeneratingBlueprintVisual, setIsGeneratingBlueprintVisual] = useState(false);
  const [isVerifyingAnalysis, setIsVerifyingAnalysis] = useState(false);
  const [analysisVerificationReport, setAnalysisVerificationReport] = useState<string | null>(null);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [engineeringReport, setEngineeringReport] = useState<string | null>(null);
  const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
  const [blueprintValidationReport, setBlueprintValidationReport] = useState<string | null>(null);
  const [cadAnalysisReport, setCadAnalysisReport] = useState<string | null>(null);
  const [isAnalyzingCad, setIsAnalyzingCad] = useState(false);
  const [isGeneratingCad, setIsGeneratingCad] = useState(false);
  const [isAnalyzingGaps, setIsAnalyzingGaps] = useState(false);
  const [gapAnalysisReport, setGapAnalysisReport] = useState<string | null>(null);
  const [userDesignNotes, setUserDesignNotes] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string, title: string } | null>(null);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [isSpecsConfirmed, setIsSpecsConfirmed] = useState(false);
  const [isBlueprintConfirmed, setIsBlueprintConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    
    // Listen for OAuth success from popup
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuth();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        fetchProducts();
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth check failed", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'google_login', 'width=500,height=600');
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setProducts([]);
      setSelectedProduct(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  useEffect(() => {
    if (user && selectedProduct) {
      fetchViews(selectedProduct.id);
    }
  }, [selectedProduct, user]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  const WorkflowProgress = () => {
    const steps = [
      { id: 1, name: 'Generate Views', icon: Layers },
      { id: 2, name: 'Gap Analysis', icon: AlertTriangle },
      { id: 3, name: 'Refine Images', icon: RefreshCw },
      { id: 4, name: 'Analyze Specs', icon: FileCode },
      { id: 5, name: 'Verify Specs', icon: CheckCircle },
      { id: 6, name: 'Initial Blueprint', icon: ImageIcon },
      { id: 7, name: 'Verify Blueprint', icon: Search },
      { id: 8, name: 'Final Blueprint', icon: Sparkles },
    ];

    return (
      <div className="flex items-center justify-between w-full px-8 py-6 bg-slate-900 border-b border-slate-800 overflow-x-auto">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = workflowStep === step.id;
          const isCompleted = workflowStep > step.id;
          
          return (
            <React.Fragment key={step.id}>
              <div className={`flex flex-col items-center gap-2 min-w-[100px] transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-50'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 
                  isActive ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 
                  'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                  {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                </div>
                <span className={`text-[10px] uppercase tracking-widest font-bold whitespace-nowrap ${isActive ? 'text-blue-400' : 'text-slate-500'}`}>
                  {step.name}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`h-[2px] flex-1 min-w-[20px] mx-2 transition-colors duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-slate-800'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };
  const fetchViews = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}/views`);
      if (!res.ok) throw new Error('Failed to fetch views');
      const data: ProductView[] = await res.json();
      setViews(data);

      // Extract engineering report if it exists in metadata
      const blueprintView = data.find(v => v.view_type === 'Technical Blueprint');
      if (blueprintView && blueprintView.metadata) {
        try {
          const meta = JSON.parse(blueprintView.metadata);
          if (meta.engineering_report) {
            setEngineeringReport(meta.engineering_report);
          }
          if (meta.technical_specs) {
            setTechnicalSpecs(meta.technical_specs);
          }
          if (meta.validation_report) {
            setBlueprintValidationReport(meta.validation_report);
          }
        } catch (e) {
          console.error('Failed to parse view metadata', e);
        }
      } else {
        setEngineeringReport(null);
        setTechnicalSpecs(null);
        setBlueprintValidationReport(null);
      }
    } catch (err) {
      console.error('Failed to fetch views', err);
    }
  };

  /**
   * Helper to call Gemini with exponential backoff for 429 errors
   */
  const safeGenerateContent = async (params: any, maxRetries = 3): Promise<GenerateContentResponse> => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        setRateLimitMessage(null);
        return await ai.models.generateContent(params);
      } catch (err: any) {
        lastError = err;
        // Check if it's a 429 error
        const isRateLimit = err.message?.includes('429') || err.status === 429 || JSON.stringify(err).includes('429');
        
        if (isRateLimit && i < maxRetries - 1) {
          const waitTime = Math.pow(2, i + 1) * 1000 + Math.random() * 1000;
          setRateLimitMessage(`Rate limit hit. Retrying in ${Math.round(waitTime/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async () => {
    if (!uploadPreview || !newProductName.trim()) {
      alert("Please provide both a name and an image.");
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProductName, image_data: uploadPreview })
      });
      
      if (!res.ok) throw new Error('Server upload failed');
      
      const newProd = await res.json();
      setProducts(prev => [newProd, ...prev]);
      setNewProductName('');
      setUploadPreview(null);
      setShowUploadModal(false);
      setSelectedProduct(newProd);
      setWorkflowStep(1);
      setIsSpecsConfirmed(false);
      setIsBlueprintConfirmed(false);
    } catch (err) {
      console.error('Upload failed', err);
      alert("Failed to save product. Please try a smaller image or check your connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const generateEngineeringAnalysis = async () => {
    if (!selectedProduct) return;
    setIsGeneratingAnalysis(true);
    setEngineeringReport(null);
    setTechnicalSpecs(null);
    setAnalysisVerificationReport(null);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      const analysisPrompt = `Analyze this product image: ${selectedProduct.name}. 
      Perform a professional engineering evaluation and provide a structured specification for a technical drawing.
      
      USER DESIGN NOTES (PRIORITIZE THESE):
      ${userDesignNotes || "None provided."}
      
      Output format:
      ## DATA POINTS (CRITICAL)
      - Exact Length: [value]mm
      - Exact Width: [value]mm
      - Exact Height: [value]mm
      - Wall Thickness: [value]mm
      - Tolerance Class: [ISO standard]
      - Weight Estimate: [value]kg
      
      ## CONSTRUCTION LOGIC
      - Internal components: [list]
      - Assembly method: [details]
      - Material specs: [details]
      - Fastening types: [screws, glue, welds, etc.]
      
      ## DRAWING REQUIREMENTS
      - Sectional view focus: [where to cut]
      - Critical callouts: [what to label]
      - Viewports: [Front, Side, Top, Isometric]
      
      ALSO, provide a JSON block at the end with these keys: length, width, height, wall_thickness, weight, material, tolerance.`;

      const response: GenerateContentResponse = await safeGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: analysisPrompt }
          ]
        }
      });

      const report = response.text || "Analysis failed.";
      setEngineeringReport(report);

      try {
        const jsonMatch = report.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const specs = JSON.parse(jsonMatch[0]);
          setTechnicalSpecs(specs);
        }
      } catch (e) {
        console.error("Failed to parse specs", e);
      }
      setWorkflowStep(5); // Move to User Verification of Specs
    } catch (err) {
      console.error('Analysis failed', err);
      alert("Failed to generate engineering analysis.");
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  const verifyEngineeringAnalysis = async () => {
    if (!selectedProduct || !engineeringReport) return;
    setIsVerifyingAnalysis(true);
    setAnalysisVerificationReport(null);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      const verifyPrompt = `ACT AS A SENIOR MECHANICAL ENGINEER.
      Verify the following Engineering Analysis Report against the original product image and user design notes.
      
      Original Product: ${selectedProduct.name}
      User Design Notes: ${userDesignNotes || "None"}
      Engineering Analysis Report:
      ${engineeringReport}
      
      TASK:
      1. Check if the dimensions and materials are realistic for this type of product.
      2. Identify any missing internal components that should be mentioned.
      3. Verify if user design notes were correctly incorporated.
      4. Provide a list of "SPECIFICATION GAPS" and "RECOMMENDED ADJUSTMENTS".
      
      Output format:
      ### ANALYSIS VERIFICATION
      - [Status: Accurate / Needs Adjustment]
      
      ### SPECIFICATION GAPS
      - [List missing details]
      
      ### RECOMMENDED ADJUSTMENTS
      - [List specific changes to the report]`;

      const response: GenerateContentResponse = await safeGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: verifyPrompt }
          ]
        }
      });

      setAnalysisVerificationReport(response.text || "Verification failed.");
    } catch (err) {
      console.error('Verification failed', err);
    } finally {
      setIsVerifyingAnalysis(false);
    }
  };

  const confirmSpecs = () => {
    setIsSpecsConfirmed(true);
    setWorkflowStep(6); // Move to Generate Initial Blueprint
  };

  const generateBlueprintVisual = async (isFinal = false) => {
    if (!selectedProduct || !engineeringReport) return;
    setIsGeneratingBlueprintVisual(true);
    setBlueprintValidationReport(null);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      const perspectiveParts = views
        .filter(v => v.view_type.includes('View') || v.view_type.includes('Perspective'))
        .map(v => {
          const base64 = v.image_url.includes(',') ? v.image_url.split(',')[1] : v.image_url;
          return { inlineData: { data: base64, mimeType: 'image/png' } };
        });

      const visualPrompt = `ACT AS A SENIOR CAD ENGINEER AND TECHNICAL ILLUSTRATOR. 
      Generate a ${isFinal ? 'FINAL, PERFECTED, MANUFACTURING-READY' : 'DETAILED INITIAL'} technical blueprint for ${selectedProduct.name}.
      
      USER DESIGN NOTES & CORRECTIONS (MANDATORY):
      ${userDesignNotes || "None provided."}
      
      YOU HAVE BEEN PROVIDED WITH MULTIPLE PERSPECTIVE VIEWS OF THE PRODUCT. YOU MUST RECONCILE ALL VIEWS TO ENSURE THE FRONT, SIDE, AND TOP VIEWS IN THE BLUEPRINT ARE 100% CONSISTENT WITH EACH OTHER AND THE ORIGINAL PRODUCT'S GEOMETRY.
      
      INTERNAL DETAILS: Pay special attention to internal structures, battery compartments, wiring channels, or mechanical linkages mentioned in the analysis or user notes.
      
      YOU MUST STRICTLY ADHERE TO THESE DATA POINTS FROM THE ENGINEERING ANALYSIS:
      ${engineeringReport}
      
      MANDATORY DRAWING SPECIFICATIONS:
      1. **DIMENSIONAL FIDELITY**: You MUST draw clear dimension lines with the EXACT numerical values (mm) provided in the "DATA POINTS" section. These numbers must be legible and placed correctly on the drawing.
      2. **CONSTRUCTION DETAILS**: Visually illustrate the "CONSTRUCTION LOGIC". Show internal components, wall thicknesses, and assembly methods (e.g., specific fasteners) as described.
      3. **MULTI-VIEW LAYOUT**: Include at least three standard orthographic views (Front, Side, Top) and one Isometric view as specified in "Viewports".
      4. **SECTIONAL ACCURACY**: If a sectional view is requested, it must show the internal structure and material density as per the "Material specs".
      5. **ANNOTATIONS**: Use leader lines and callouts to label every component mentioned in the "Internal components" list.
      6. **TITLE BLOCK**: Include a detailed title block in the bottom right with: Product Name, Scale, Date, and Material Specs.
      7. **STYLE**: High-contrast black-on-white technical line art. No gradients, no shadows, no artistic flair. Pure engineering precision.
      
      Respond ONLY with the generated image.`;

      const response: GenerateContentResponse = await safeGenerateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            ...perspectiveParts,
            { text: visualPrompt }
          ]
        },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });

      const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        const metadata = JSON.stringify({
          engineering_report: engineeringReport,
          technical_specs: technicalSpecs,
          validation_report: null,
          is_final: isFinal
        });
        await saveView(selectedProduct.id, isFinal ? 'Final Technical Blueprint' : 'Technical Blueprint', imageUrl, 'AI Engineering Analysis + Nano Banana', metadata);
        fetchViews(selectedProduct.id);

        if (!isFinal) {
          // Auto-validate initial blueprint
          const validationPrompt = `Evaluate the generated technical blueprint against the original product image and the engineering analysis report.
          Original Product Name: ${selectedProduct.name}
          Engineering Analysis Report: ${engineeringReport}
          
          Critically assess the blueprint's **technical accuracy** and **adherence to specifications**:
          1. **DIMENSIONAL ACCURACY**: Are the numerical dimensions explicitly drawn on the blueprint consistent with the EXACT DATA POINTS in the Engineering Analysis Report?
          2. **CONSTRUCTION DETAIL CONSISTENCY**: Does the internal construction and assembly shown in the blueprint precisely match the CONSTRUCTION LOGIC described?
          3. **ANNOTATION CLARITY**: Are all required annotations present and correctly placed?
          4. **OVERALL REPRESENTATION**: Does the blueprint accurately represent the product features and proportions?
          
          Provide a concise, actionable validation report.`;

          const validationResponse: GenerateContentResponse = await safeGenerateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: 'image/png' } },
                { inlineData: { data: imagePart.inlineData.data, mimeType: 'image/png' } },
                { text: validationPrompt }
              ]
            }
          });

          setBlueprintValidationReport(validationResponse.text || "Validation failed.");
          setWorkflowStep(7); // Move to Verify Blueprint
        } else {
          setWorkflowStep(8); // Final Step
        }
      }
    } catch (err) {
      console.error('Blueprint generation failed', err);
      alert("Failed to generate technical blueprint.");
    } finally {
      setIsGeneratingBlueprintVisual(false);
    }
  };

  const confirmBlueprint = () => {
    setIsBlueprintConfirmed(true);
    generateBlueprintVisual(true); // Generate final blueprint
  };
  const generateAllViews = async () => {
    if (!selectedProduct) return;
    setIsGenerating(true);

    const angles = [
      { name: 'Side View', prompt: 'Generate a high-quality side profile view of this product. Ensure 100% consistency with the original design.' },
      { name: 'Back View', prompt: 'Generate a high-quality back view of this product. Ensure 100% consistency with the original design.' },
      { name: 'Top View', prompt: 'Generate a high-quality top-down view of this product. Ensure 100% consistency with the original design.' }
    ];

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];

      for (const angle of angles) {
        const response: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: angle.prompt + ` USER DESIGN NOTES: ${userDesignNotes || "None"}. Keep the product design, internal features, and colors identical to the original. Respond ONLY with the image.` }
            ]
          },
          config: {
            imageConfig: { aspectRatio: "1:1" }
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          await saveView(selectedProduct.id, angle.name, imageUrl, 'Nano Banana Batch');
          // Update UI incrementally
          fetchViews(selectedProduct.id);
        }
      }
      setWorkflowStep(2); // Move to Gap Analysis
    } catch (err) {
      console.error('Generation failed', err);
      alert("One or more views failed to generate. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateViewsBasedOnGaps = async () => {
    if (!selectedProduct) return;
    setIsGenerating(true);

    const angles = [
      { name: 'Refined Side View', prompt: 'Generate a high-quality side profile view. INCORPORATE THESE CORRECTIONS: ' + userDesignNotes },
      { name: 'Refined Back View', prompt: 'Generate a high-quality back view. INCORPORATE THESE CORRECTIONS: ' + userDesignNotes },
      { name: 'Refined Top View', prompt: 'Generate a high-quality top-down view. INCORPORATE THESE CORRECTIONS: ' + userDesignNotes }
    ];

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      for (const angle of angles) {
        const response: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: angle.prompt + " Respond ONLY with the image." }
            ]
          },
          config: { imageConfig: { aspectRatio: "1:1" } }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          await saveView(selectedProduct.id, angle.name, imageUrl, 'Nano Banana Refined');
          fetchViews(selectedProduct.id);
        }
      }
      setWorkflowStep(4); // Move to Analyze Specs
    } catch (err) {
      console.error('Regeneration failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSingleView = async (type: 'AI' | 'SEARCH') => {
    if (!selectedProduct) return;
    setIsGenerating(true);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      if (type === 'AI') {
        const response: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: "Generate a unique perspective view of this product. Keep it consistent. Respond ONLY with the image." }
            ]
          }
        });

        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          await saveView(selectedProduct.id, 'Custom AI View', imageUrl, 'Nano Banana');
        }
      } else {
        const response: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: `Find different views of ${selectedProduct.name}. Describe the visual details of its sides and back.` }
            ]
          },
          config: { tools: [{ googleSearch: {} }] }
        });

        const searchInfo = response.text;
        const genResponse: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: `Generate a view of ${selectedProduct.name} based on these details: ${searchInfo}. Respond ONLY with the image.` }
            ]
          }
        });

        const imagePart = genResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
          await saveView(selectedProduct.id, 'Search-Informed View', imageUrl, 'Search + AI');
        }
      }
      fetchViews(selectedProduct.id);
    } catch (err) {
      console.error('Generation failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const analyzeDesignGaps = async () => {
    if (!selectedProduct) return;
    setIsAnalyzingGaps(true);
    setGapAnalysisReport(null);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      const perspectiveParts = views
        .filter(v => v.view_type.includes('View') || v.view_type.includes('Perspective'))
        .map(v => {
          const base64 = v.image_url.includes(',') ? v.image_url.split(',')[1] : v.image_url;
          return { inlineData: { data: base64, mimeType: 'image/png' } };
        });

      const gapPrompt = `ACT AS A SENIOR QUALITY ASSURANCE ENGINEER AND PRODUCT DESIGNER.
      Compare the original product image with the generated perspective views.
      
      TASK:
      1. Identify missing features in the generated views that are present in the original.
      2. Identify geometric inconsistencies between views (e.g., "The side view shows a curve that is sharp in the top view").
      3. Suggest internal components and construction details based on the product's likely function.
      4. Provide specific, actionable "Design Notes" that can be used to fix these issues in the final blueprint.
      
      Output format:
      ### 1. VERIFIED FEATURES
      - [List what is correct]
      
      ### 2. DETECTED GAPS & INCONSISTENCIES
      - [List what is missing or wrong]
      
      ### 3. INTERNAL DETAIL SUGGESTIONS
      - [List inferred internal components]
      
      ### 4. RECOMMENDED CORRECTIONS (FOR BLUEPRINT)
      - [List specific instructions for the blueprint generator]`;

      const response: GenerateContentResponse = await safeGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            ...perspectiveParts,
            { text: gapPrompt }
          ]
        }
      });

      setGapAnalysisReport(response.text || "Gap analysis failed.");
      setWorkflowStep(3); // Move to Refine Images
    } catch (err) {
      console.error('Gap analysis failed', err);
      alert("Failed to analyze design gaps.");
    } finally {
      setIsAnalyzingGaps(false);
    }
  };

  const handleDxfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setIsAnalyzingCad(true);
    setCadAnalysisReport(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dxfContent = event.target?.result as string;
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfContent);

        // Calculate bounding box and basic stats
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let entityCount = 0;

        if (dxf && dxf.entities) {
          entityCount = dxf.entities.length;
          dxf.entities.forEach((entity: any) => {
            if (entity.vertices) {
              entity.vertices.forEach((v: any) => {
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
              });
            } else if (entity.position) {
              minX = Math.min(minX, entity.position.x);
              minY = Math.min(minY, entity.position.y);
              maxX = Math.max(maxX, entity.position.x);
              maxY = Math.max(maxY, entity.position.y);
            }
          });
        }

        const width = maxX - minX;
        const height = maxY - minY;
        const metadata = {
          width: width === Infinity ? 0 : width,
          height: height === Infinity ? 0 : height,
          entities: entityCount,
          layers: Object.keys((dxf as any).layers || {}).length
        };

        // Save DXF as a "view"
        await saveView(selectedProduct.id, 'CAD File (DXF)', dxfContent, 'User Upload', JSON.stringify(metadata));
        fetchViews(selectedProduct.id);

        // AI Analysis of the CAD data
        const cadPrompt = `Analyze this CAD data (DXF) for the product: ${selectedProduct.name}.
        
        CAD METADATA:
        - Bounding Box: ${metadata.width.toFixed(2)}mm x ${metadata.height.toFixed(2)}mm
        - Total Entities: ${metadata.entities}
        - Layers: ${metadata.layers}
        
        ENGINEERING ANALYSIS CONTEXT:
        ${engineeringReport || "No engineering report available yet."}
        
        TASK:
        1. Compare the CAD bounding box dimensions against the estimated dimensions in the Engineering Analysis Report.
        2. Identify if the CAD file complexity (entities/layers) matches the expected construction logic.
        3. Flag any significant dimensional discrepancies (e.g., if the CAD is 10x larger or smaller than expected).
        4. Provide a "CAD CHECKER" status: PASS, WARNING, or FAIL based on consistency.`;

        const response: GenerateContentResponse = await safeGenerateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: selectedProduct.image_data.split(',')[1], mimeType: 'image/png' } },
              { text: cadPrompt }
            ]
          }
        });

        setCadAnalysisReport(response.text || "CAD Analysis failed.");
      } catch (err) {
        console.error('DXF parsing failed', err);
        alert("Failed to parse DXF file. Please ensure it is a valid ASCII DXF.");
      } finally {
        setIsAnalyzingCad(false);
      }
    };
    reader.readAsText(file);
  };

  const generateCadFile = async () => {
    if (!selectedProduct || !engineeringReport) {
      alert("Please generate a Technical Blueprint first to provide engineering context.");
      return;
    }

    setIsGeneratingCad(true);
    setRateLimitMessage(null);

    try {
      const cadPrompt = `Based on the Engineering Analysis Report and Technical Specifications below, generate a structured JSON representation of a 2D CAD drawing (DXF) for the product: ${selectedProduct.name}.
      
      ENGINEERING ANALYSIS:
      ${engineeringReport}
      
      TECHNICAL SPECIFICATIONS (DATA POINTS):
      ${technicalSpecs ? JSON.stringify(technicalSpecs, null, 2) : 'No structured specs available.'}
      
      REQUIREMENTS:
      1. Create a simplified 2D technical drawing.
      2. Include the main outline of the product using LINE entities.
      3. Include circles for holes or rounded features using CIRCLE entities.
      4. Include dimension labels using TEXT entities.
      5. Use standard units (mm).
      6. Center the drawing around (0,0) or start from (0,0).
      7. **STRICTLY FOLLOW** the dimensions (length, width, height) provided in the Technical Specifications.
      
      The output MUST be a JSON object with an "entities" array.
      Each entity should have:
      - type: "LINE", "CIRCLE", or "TEXT"
      - layer: "OUTLINE", "DIMENSIONS", or "ANNOTATIONS"
      - For LINE: x1, y1, x2, y2
      - For CIRCLE: cx, cy, r
      - For TEXT: x, y, text, height (default 5)`;

      const response: GenerateContentResponse = await safeGenerateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: selectedProduct.image_data.split(',')[1], mimeType: 'image/png' } },
            { text: cadPrompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    layer: { type: Type.STRING },
                    x1: { type: Type.NUMBER },
                    y1: { type: Type.NUMBER },
                    x2: { type: Type.NUMBER },
                    y2: { type: Type.NUMBER },
                    cx: { type: Type.NUMBER },
                    cy: { type: Type.NUMBER },
                    r: { type: Type.NUMBER },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    text: { type: Type.STRING },
                    height: { type: Type.NUMBER }
                  },
                  required: ["type"]
                }
              }
            },
            required: ["entities"]
          }
        }
      });

      const cadData = JSON.parse(response.text || '{"entities":[]}');
      const dxf = new DxfGenerator();

      // Limit entities to prevent freezing AutoCAD
      const entities = (cadData.entities || []).slice(0, 500);

      entities.forEach((entity: any) => {
        switch (entity.type) {
          case 'LINE':
            dxf.addLine(entity.x1 || 0, entity.y1 || 0, entity.x2 || 0, entity.y2 || 0, entity.layer || 'OUTLINE');
            break;
          case 'CIRCLE':
            dxf.addCircle(entity.cx || 0, entity.cy || 0, entity.r || 5, entity.layer || 'OUTLINE');
            break;
          case 'TEXT':
            dxf.addText(entity.x || 0, entity.y || 0, entity.text || '', entity.height || 5, entity.layer || 'ANNOTATIONS');
            break;
        }
      });

      const dxfString = dxf.generate();
      const blob = new Blob([dxfString], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedProduct.name.replace(/\s+/g, '_')}_drawing.dxf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Also save this as a "view" in the database
      await saveView(selectedProduct.id, 'Generated CAD (DXF)', dxfString, 'AI Generated', JSON.stringify({ entities: cadData.entities.length }));
      fetchViews(selectedProduct.id);

    } catch (err) {
      console.error('CAD generation failed', err);
      alert("Failed to generate CAD file. Please try again.");
    } finally {
      setIsGeneratingCad(false);
    }
  };

  const saveView = async (productId: number, type: string, url: string, source: string, metadata?: string) => {
    await fetch(`/api/products/${productId}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view_type: type, image_url: url, source, metadata })
    });
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="text-[#E4E3E0] animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-6 text-[#E4E3E0]">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 border-2 border-[#E4E3E0] flex items-center justify-center rotate-45">
                <Layers className="-rotate-45" size={24} />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Blueprint AI Pro</h1>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">Engineering Intelligence Platform</p>
          </div>

          <div className="bg-[#E4E3E0] p-8 border border-[#141414] shadow-2xl space-y-6">
            <div className="space-y-2">
              <h2 className="text-[#141414] text-xl font-bold uppercase tracking-tight">Access Required</h2>
              <p className="text-[#141414] text-[10px] font-mono opacity-60">Sign in with your Google account to access the engineering dashboard and cloud-synced projects.</p>
            </div>
            
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 hover:bg-opacity-90 transition-all group"
            >
              <Globe size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Continue with Google</span>
            </button>

            <div className="pt-4 border-t border-[#141414]/10">
              <p className="text-[#141414] text-[8px] font-mono opacity-40 uppercase tracking-widest">Secure OAuth 2.0 Authentication</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-8 opacity-30">
            <div className="flex flex-col items-center gap-2">
              <Sparkles size={16} />
              <span className="text-[8px] font-bold uppercase tracking-widest">AI Synthesis</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <FileCode size={16} />
              <span className="text-[8px] font-bold uppercase tracking-widest">CAD Export</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Database size={16} />
              <span className="text-[8px] font-bold uppercase tracking-widest">Cloud Sync</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-[#141414] flex items-center justify-between px-8 bg-[#E4E3E0] sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#141414] flex items-center justify-center">
              <Settings className="text-[#E4E3E0]" size={18} />
            </div>
            <h1 className="font-mono text-sm font-bold tracking-tighter uppercase">AI.BLUEPRINT.v2</h1>
          </div>
          <div className="h-4 w-[1px] bg-[#141414] opacity-20" />
          <div className="flex gap-4">
            <button className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Dashboard</button>
            <button className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Archive</button>
            <button className="text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Settings</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold uppercase tracking-tight">{user.name}</p>
            <button onClick={handleLogout} className="text-[8px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity">Sign Out</button>
          </div>
          <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-[#141414]" />
          <div className="h-4 w-[1px] bg-[#141414] opacity-20" />
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all"
          >
            <Plus size={14} />
            New Project
          </button>
        </div>
      </nav>

      {selectedProduct && <WorkflowProgress />}

      <main className="grid grid-cols-12 min-h-[calc(100vh-64px)]">
        {/* Sidebar: Project List */}
        <aside className="col-span-3 border-r border-[#141414] bg-[#E4E3E0] overflow-y-auto max-h-[calc(100vh-140px)]">
          <div className="p-4 border-b border-[#141414] flex items-center justify-between bg-[#D4D3D0]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <History size={14} />
              Project History
            </h3>
            <span className="text-[10px] font-mono opacity-50">{products.length} ITEMS</span>
          </div>
          <div className="divide-y divide-[#141414]">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setWorkflowStep(1); // Reset workflow for new selection
                  setIsSpecsConfirmed(false);
                  setIsBlueprintConfirmed(false);
                }}
                className={`w-full p-4 text-left transition-all group hover:bg-[#D4D3D0] ${
                  selectedProduct?.id === product.id ? 'bg-[#141414] text-[#E4E3E0]' : ''
                }`}
              >
                <div className="flex gap-4">
                  <div className={`w-12 h-12 border border-[#141414] overflow-hidden bg-white flex-shrink-0 ${
                    selectedProduct?.id === product.id ? 'border-[#E4E3E0]' : ''
                  }`}>
                    <img src={product.image_data} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-[11px] font-bold uppercase tracking-tight truncate">{product.name}</h4>
                      <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                        selectedProduct?.id === product.id ? 'text-[#E4E3E0]' : ''
                      }`} />
                    </div>
                    <p className={`text-[9px] font-mono mt-1 opacity-50 ${
                      selectedProduct?.id === product.id ? 'text-[#E4E3E0]' : ''
                    }`}>
                      ID: {product.id.toString().padStart(4, '0')} | {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {products.length === 0 && (
              <div className="p-12 text-center opacity-30">
                <p className="text-[10px] font-bold uppercase tracking-widest">No Projects Found</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="col-span-9 bg-[#E4E3E0] overflow-y-auto max-h-[calc(100vh-140px)]">
          <AnimatePresence mode="wait">
            {selectedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-8"
              >
                {/* Header Section */}
                <div className="flex justify-between items-end mb-8 border-b border-[#141414] pb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-[#141414] text-[#E4E3E0] text-[8px] font-bold uppercase tracking-widest">Active Project</span>
                      <span className="text-[10px] font-mono opacity-50">v2.0.4</span>
                    </div>
                    <h2 className="text-4xl font-bold uppercase tracking-tighter leading-none">{selectedProduct.name}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => document.getElementById('dxf-upload')?.click()}
                      className="px-4 py-2 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                    >
                      Import DXF
                    </button>
                    <input id="dxf-upload" type="file" accept=".dxf" className="hidden" onChange={handleDxfUpload} />
                    <button 
                      onClick={generateCadFile}
                      className="px-4 py-2 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                    >
                      Export CAD
                    </button>
                  </div>
                </div>

                {/* Workflow Action Bar */}
                <div className="mb-8 p-6 bg-[#141414] text-[#E4E3E0] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-[#E4E3E0] flex items-center justify-center">
                      <Info size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Current Workflow Step</p>
                      <h3 className="text-lg font-bold uppercase tracking-tight">
                        {workflowStep === 1 && "Generate Initial Perspectives"}
                        {workflowStep === 2 && "Perform Design Gap Analysis"}
                        {workflowStep === 3 && "Refine Perspective Images"}
                        {workflowStep === 4 && "Analyze Engineering Specs"}
                        {workflowStep === 5 && "Verify Technical Specifications"}
                        {workflowStep === 6 && "Generate Initial Blueprint"}
                        {workflowStep === 7 && "Verify Technical Blueprint"}
                        {workflowStep === 8 && "Project Finalized"}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {workflowStep === 1 && (
                      <button 
                        onClick={generateAllViews}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-[#E4E3E0] text-[#141414] text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                      >
                        {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Layers size={14} />}
                        Start Generation
                      </button>
                    )}
                    {workflowStep === 2 && (
                      <button 
                        onClick={analyzeDesignGaps}
                        disabled={isAnalyzingGaps}
                        className="px-6 py-3 bg-[#E4E3E0] text-[#141414] text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                      >
                        {isAnalyzingGaps ? <Loader2 className="animate-spin" size={14} /> : <AlertTriangle size={14} />}
                        Analyze Gaps
                      </button>
                    )}
                    {workflowStep === 3 && (
                      <button 
                        onClick={regenerateViewsBasedOnGaps}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-[#E4E3E0] text-[#141414] text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                      >
                        {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                        Refine Images
                      </button>
                    )}
                    {workflowStep === 4 && (
                      <button 
                        onClick={generateEngineeringAnalysis}
                        disabled={isGeneratingAnalysis}
                        className="px-6 py-3 bg-[#E4E3E0] text-[#141414] text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                      >
                        {isGeneratingAnalysis ? <Loader2 className="animate-spin" size={14} /> : <FileCode size={14} />}
                        Analyze Specs
                      </button>
                    )}
                    {workflowStep === 5 && (
                      <button 
                        onClick={confirmSpecs}
                        className="px-6 py-3 bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2"
                      >
                        <Check size={14} />
                        Confirm Specs
                      </button>
                    )}
                    {workflowStep === 6 && (
                      <button 
                        onClick={() => generateBlueprintVisual(false)}
                        disabled={isGeneratingBlueprintVisual}
                        className="px-6 py-3 bg-[#E4E3E0] text-[#141414] text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-2"
                      >
                        {isGeneratingBlueprintVisual ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                        Generate Blueprint
                      </button>
                    )}
                    {workflowStep === 7 && (
                      <button 
                        onClick={confirmBlueprint}
                        className="px-6 py-3 bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center gap-2"
                      >
                        <Check size={14} />
                        Confirm & Finalize
                      </button>
                    )}
                    {workflowStep === 8 && (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle size={20} />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Project Complete</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-8">
                  {/* Left Column: Notes & Reports */}
                  <div className="col-span-4 space-y-6">
                    <div className="p-6 border border-[#141414] bg-[#D4D3D0]">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={14} />
                          Design Directives
                        </h4>
                        <button onClick={() => setUserDesignNotes('')} className="text-[9px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100">Reset</button>
                      </div>
                      <textarea
                        value={userDesignNotes}
                        onChange={(e) => setUserDesignNotes(e.target.value)}
                        placeholder="Enter technical directives..."
                        className="w-full h-48 p-3 text-[11px] font-mono bg-white border border-[#141414] focus:ring-1 focus:ring-[#141414] outline-none resize-none"
                      />
                    </div>

                    {gapAnalysisReport && (
                      <div className="p-6 border border-[#141414] bg-rose-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-rose-900 flex items-center gap-2">
                            <AlertTriangle size={14} />
                            Gap Analysis
                          </h4>
                          <button 
                            onClick={() => {
                              const corrections = gapAnalysisReport.split('### 4. RECOMMENDED CORRECTIONS (FOR BLUEPRINT)')[1] || '';
                              setUserDesignNotes(prev => prev + (prev ? '\n' : '') + corrections.trim());
                              setGapAnalysisReport(null);
                            }}
                            className="text-[9px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-800"
                          >
                            Apply
                          </button>
                        </div>
                        <div className="prose prose-sm prose-rose max-w-none text-[10px] leading-relaxed">
                          <Markdown>{gapAnalysisReport}</Markdown>
                        </div>
                      </div>
                    )}

                    {analysisVerificationReport && (
                      <div className="p-6 border border-[#141414] bg-emerald-50">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-900 flex items-center gap-2">
                            <CheckCircle size={14} />
                            Spec Verification
                          </h4>
                          <button 
                            onClick={() => {
                              const adjustments = analysisVerificationReport.split('### RECOMMENDED ADJUSTMENTS')[1] || '';
                              setUserDesignNotes(prev => prev + (prev ? '\n' : '') + adjustments.trim());
                              setAnalysisVerificationReport(null);
                            }}
                            className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-800"
                          >
                            Apply
                          </button>
                        </div>
                        <div className="prose prose-sm prose-emerald max-w-none text-[10px] leading-relaxed">
                          <Markdown>{analysisVerificationReport}</Markdown>
                        </div>
                      </div>
                    )}

                    {engineeringReport && (
                      <div className="p-6 border border-[#141414] bg-white">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileCode size={14} />
                          Engineering Specs
                        </h4>
                        <div className="prose prose-sm max-w-none text-[10px] leading-relaxed">
                          <Markdown>{engineeringReport}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Visual Assets */}
                  <div className="col-span-8 space-y-8">
                    {/* Primary View */}
                    <div className="border border-[#141414] bg-white p-2">
                      <div className="aspect-video relative group cursor-zoom-in overflow-hidden bg-[#F0F0F0]" onClick={() => setPreviewImage({ url: selectedProduct.image_data, title: selectedProduct.name })}>
                        <img src={selectedProduct.image_data} alt={selectedProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        <div className="absolute top-4 left-4 bg-[#141414] text-[#E4E3E0] text-[8px] font-bold uppercase tracking-widest px-2 py-1">SOURCE_REF</div>
                      </div>
                    </div>

                    {/* Technical Blueprint (If exists) */}
                    {views.some(v => v.view_type === 'Technical Blueprint') && (
                      <div className="border border-[#141414] bg-white p-2">
                        <div className="aspect-video relative group cursor-zoom-in overflow-hidden bg-[#F0F0F0]" onClick={() => setPreviewImage({ url: views.find(v => v.view_type === 'Technical Blueprint')?.image_url || '', title: 'Technical Blueprint' })}>
                          <img src={views.find(v => v.view_type === 'Technical Blueprint')?.image_url} alt="Blueprint" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          <div className="absolute top-4 left-4 bg-[#141414] text-[#E4E3E0] text-[8px] font-bold uppercase tracking-widest px-2 py-1">BLUEPRINT_01</div>
                          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                            <span className="bg-emerald-500 text-white text-[8px] px-2 py-1 font-bold uppercase tracking-widest">Validated</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generated Views Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {views.filter(v => v.view_type !== 'Technical Blueprint').map((view, index) => (
                        <div key={view.id} className="border border-[#141414] bg-white p-1">
                          <div className="aspect-square relative group cursor-zoom-in overflow-hidden bg-[#F0F0F0]" onClick={() => setPreviewImage({ url: view.image_url, title: view.view_type })}>
                            <img src={view.image_url} alt={view.view_type} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 left-2 bg-[#141414] text-[#E4E3E0] text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">IMG_{String(index + 1).padStart(2, '0')}</div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-[#141414] text-[#E4E3E0] opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[8px] font-bold uppercase tracking-widest truncate">{view.view_type}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(isGenerating || isGeneratingBlueprintVisual || isAnalyzingGaps) && (
                        <div className="aspect-square border border-dashed border-[#141414] flex flex-col items-center justify-center p-4 text-center">
                          <Loader2 className="animate-spin mb-2" size={20} />
                          <p className="text-[8px] font-bold uppercase tracking-widest opacity-50">Processing Asset...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="w-24 h-24 border border-dashed border-[#141414] flex items-center justify-center mb-8 opacity-20">
                  <Search size={40} />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tighter mb-2">No Project Selected</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 max-w-xs mx-auto">Select a project from the sidebar or initialize a new one to begin the blueprint workflow.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
              className="absolute inset-0 bg-[#141414]/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-md bg-[#E4E3E0] border border-[#141414] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#141414] flex justify-between items-center bg-[#D4D3D0]">
                <h3 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <Plus size={14} />
                  Initialize New Project
                </h3>
                <button onClick={() => setShowUploadModal(false)} className="opacity-50 hover:opacity-100 transition-opacity">
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Project Name</label>
                  <input 
                    type="text" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. PROTOTYPE_X1"
                    className="w-full p-3 text-[11px] font-mono bg-white border border-[#141414] focus:ring-1 focus:ring-[#141414] outline-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-50">Reference Image</label>
                  {uploadPreview ? (
                    <div className="relative aspect-video border border-[#141414] bg-white p-1">
                      <img src={uploadPreview} className="w-full h-full object-contain" />
                      <button 
                        onClick={() => setUploadPreview(null)}
                        className="absolute top-2 right-2 p-1.5 bg-[#141414] text-[#E4E3E0] hover:bg-opacity-90 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-[#141414] aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-[#D4D3D0] transition-all group"
                    >
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                      <Plus className="opacity-20 group-hover:opacity-100 transition-opacity mb-2" size={24} />
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">Upload Reference</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <button 
                    onClick={() => { setShowUploadModal(false); setUploadPreview(null); }}
                    className="flex-1 px-4 py-3 border border-[#141414] text-[10px] font-bold uppercase tracking-widest hover:bg-[#D4D3D0] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!uploadPreview || !newProductName.trim() || isUploading}
                    onClick={handleSaveProduct}
                    className="flex-1 px-4 py-3 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest hover:bg-opacity-90 transition-all disabled:opacity-50"
                  >
                    {isUploading ? 'Processing...' : 'Initialize'}
                  </button>
                </div>
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-[#E4E3E0]/80 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
                  <Loader2 className="text-[#141414] animate-spin" size={32} />
                  <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Syncing Database...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-[#141414]/95 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-6xl h-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 text-[#E4E3E0]">
                <div>
                  <h3 className="text-2xl font-bold uppercase tracking-tighter">{previewImage.title}</h3>
                  <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">{selectedProduct?.name} // ASSET_PREVIEW</p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => downloadImage(previewImage.url, `${selectedProduct?.name}-${previewImage.title}.png`)}
                    className="px-4 py-2 border border-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] transition-all"
                  >
                    Download
                  </button>
                  <button onClick={() => setPreviewImage(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div className="flex-1 border border-[#E4E3E0]/20 bg-white/5 flex items-center justify-center p-4 overflow-hidden">
                <img src={previewImage.url} alt={previewImage.title} className="max-w-full max-h-full object-contain" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #141414;
        }
        .prose {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .prose h1, .prose h2, .prose h3, .prose h4 {
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 800;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        .prose p {
          margin-bottom: 1em;
          opacity: 0.8;
        }
        .prose ul {
          list-style-type: square;
          padding-left: 1.5em;
          margin-bottom: 1em;
        }
        .prose li {
          margin-bottom: 0.25em;
        }
      `}</style>
    </div>
  );
}
