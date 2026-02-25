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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

// Types
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
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [views, setViews] = useState<ProductView[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
  const [engineeringReport, setEngineeringReport] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string, title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchViews(selectedProduct.id);
    }
  }, [selectedProduct]);

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

  const fetchViews = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}/views`);
      if (!res.ok) throw new Error('Failed to fetch views');
      const data = await res.json();
      setViews(data);
    } catch (err) {
      console.error('Failed to fetch views', err);
    }
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
    } catch (err) {
      console.error('Upload failed', err);
      alert("Failed to save product. Please try a smaller image or check your connection.");
    } finally {
      setIsUploading(false);
    }
  };

  const generateTechnicalBlueprint = async () => {
    if (!selectedProduct) return;
    setIsGeneratingBlueprint(true);
    setEngineeringReport(null);

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];
      
      // Stage 1: Engineering Analysis (Gemini 3 Flash)
      const analysisPrompt = `Analyze this product image: ${selectedProduct.name}. 
      Perform a professional engineering evaluation:
      1. Estimate realistic real-world dimensions (Length, Width, Height) in mm.
      2. Identify likely materials and manufacturing processes (e.g., injection molding, CNC machining).
      3. Describe the internal construction logic and assembly steps.
      4. Note any critical tolerances or safety requirements.
      Provide a concise but highly technical report.`;

      const analysisResponse: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: analysisPrompt }
          ]
        }
      });

      const report = analysisResponse.text || "Analysis failed.";
      setEngineeringReport(report);

      // Stage 2: Logical Visualization (Gemini 2.5 Flash Image)
      const visualPrompt = `Generate a professional technical blueprint for ${selectedProduct.name} based on this engineering analysis:
      
      ${report}
      
      The drawing MUST strictly follow the dimensions and construction logic described above.
      Include:
      - Orthographic projections with the specific dimensions mentioned.
      - Sectional views showing the internal assembly described.
      - A professional title block with material specs.
      Style: High-precision engineering drawing, black lines on white background. Respond ONLY with the image.`;

      const visualResponse: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
            { text: visualPrompt }
          ]
        },
        config: {
          imageConfig: { aspectRatio: "16:9" }
        }
      });

      const imagePart = visualResponse.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (imagePart?.inlineData) {
        const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
        await saveView(selectedProduct.id, 'Technical Blueprint', imageUrl, 'AI Engineering Analysis + Nano Banana');
        fetchViews(selectedProduct.id);
      }
    } catch (err) {
      console.error('Blueprint generation failed', err);
      alert("Failed to generate technical blueprint.");
    } finally {
      setIsGeneratingBlueprint(false);
    }
  };

  const generateAllViews = async () => {
    if (!selectedProduct) return;
    setIsGenerating(true);

    const angles = [
      { name: 'Side View', prompt: 'Generate a high-quality side profile view of this product.' },
      { name: 'Back View', prompt: 'Generate a high-quality back view of this product.' },
      { name: 'Top View', prompt: 'Generate a high-quality top-down view of this product.' }
    ];

    try {
      const base64Data = selectedProduct.image_data.split(',')[1];

      for (const angle of angles) {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/png' } },
              { text: angle.prompt + " Keep the product design and colors identical to the original. Respond ONLY with the image." }
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
    } catch (err) {
      console.error('Generation failed', err);
      alert("One or more views failed to generate. Please try again.");
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
        const response: GenerateContentResponse = await ai.models.generateContent({
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
        const response: GenerateContentResponse = await ai.models.generateContent({
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
        const genResponse: GenerateContentResponse = await ai.models.generateContent({
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

  const saveView = async (productId: number, type: string, url: string, source: string) => {
    await fetch(`/api/products/${productId}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view_type: type, image_url: url, source })
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Layers className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ERP Vision API</h1>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm font-medium"
        >
          <Plus size={18} />
          Add Product
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-12 gap-8">
        {/* Sidebar / Product List */}
        <div className="col-span-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Database size={14} />
              SQLite Inventory
            </h2>
            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">{products.length} Items</span>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-180px)] pr-2 custom-scrollbar">
            {products.map((product) => (
              <motion.div
                key={product.id}
                layoutId={`product-${product.id}`}
                onClick={() => setSelectedProduct(product)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedProduct?.id === product.id 
                    ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                    : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
              >
                <div className="flex gap-4">
                  <img 
                    src={product.image_data} 
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover bg-gray-100 border border-gray-100"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{product.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Added {new Date(product.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight size={18} className={`self-center ${selectedProduct?.id === product.id ? 'text-indigo-500' : 'text-gray-300'}`} />
                </div>
              </motion.div>
            ))}
            {products.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <ImageIcon className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-400">No products in database</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Viewport */}
        <div className="col-span-8">
          <AnimatePresence mode="wait">
            {selectedProduct ? (
              <motion.div
                key={selectedProduct.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Product Detail Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <Database size={12} />
                      Product ID: #{selectedProduct.id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      disabled={isGenerating || isGeneratingBlueprint}
                      onClick={generateTechnicalBlueprint}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
                    >
                      {isGeneratingBlueprint ? <Loader2 className="animate-spin" size={16} /> : <ImageIcon size={16} />}
                      Technical Blueprint
                    </button>
                    <button 
                      disabled={isGenerating || isGeneratingBlueprint}
                      onClick={generateAllViews}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Layers size={16} />}
                      Generate All Views
                    </button>
                    <button 
                      disabled={isGenerating || isGeneratingBlueprint}
                      onClick={() => generateSingleView('SEARCH')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 font-medium text-sm"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Globe size={16} />}
                      Search Lens
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-8">
                  <div className="space-y-8">
                    {/* Technical Blueprint Section (If exists) */}
                    {views.some(v => v.view_type === 'Technical Blueprint') && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon size={14} />
                            Engineering Blueprint & Construction Details
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6">
                          <div 
                            onClick={() => setPreviewImage({ url: views.find(v => v.view_type === 'Technical Blueprint')?.image_url || '', title: 'Technical Blueprint' })}
                            className="col-span-2 aspect-video rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm group relative cursor-zoom-in"
                          >
                            <img 
                              src={views.find(v => v.view_type === 'Technical Blueprint')?.image_url} 
                              alt="Technical Blueprint"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-4 right-4">
                              <span className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded font-mono">CAD/CAM READY</span>
                            </div>
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white/90 p-2 rounded-full shadow-lg">
                                <Search size={20} className="text-slate-800" />
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 overflow-y-auto max-h-[400px] custom-scrollbar">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Sparkles size={12} className="text-indigo-500" />
                              Engineering Analysis Report
                            </h4>
                            <div className="prose prose-sm prose-slate max-w-none text-xs leading-relaxed">
                              {engineeringReport ? (
                                <Markdown>{engineeringReport}</Markdown>
                              ) : (
                                <p className="text-slate-400 italic">Analysis report generated during blueprint creation will appear here.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-8">
                      {/* Primary Image */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Primary View (SQ)</h3>
                        <div 
                          onClick={() => setPreviewImage({ url: selectedProduct.image_data, title: selectedProduct.name })}
                          className="aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group relative cursor-zoom-in"
                        >
                          <img 
                            src={selectedProduct.image_data} 
                            alt={selectedProduct.name}
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Click to Enlarge</span>
                          </div>
                        </div>
                      </div>

                      {/* Generated Views */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Generated Perspectives</h3>
                        <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {views.filter(v => v.view_type !== 'Technical Blueprint').map((view) => (
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              key={view.id} 
                              onClick={() => setPreviewImage({ url: view.image_url, title: view.view_type })}
                              className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative group cursor-zoom-in"
                            >
                              <img 
                                src={view.image_url} 
                                alt={view.view_type}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white font-medium truncate">{view.view_type}</p>
                                <p className="text-[8px] text-white/70 truncate">{view.source}</p>
                              </div>
                            </motion.div>
                          ))}
                          {(isGenerating || isGeneratingBlueprint) && (
                            <div className="aspect-square rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center gap-2">
                              <Loader2 className="text-indigo-500 animate-spin" size={24} />
                              <span className="text-[10px] text-indigo-600 font-medium animate-pulse text-center px-2">Processing...</span>
                            </div>
                          )}
                          {views.filter(v => v.view_type !== 'Technical Blueprint').length === 0 && !isGenerating && (
                            <div className="col-span-2 py-12 text-center border border-dashed border-gray-200 rounded-xl">
                              <ImageIcon className="mx-auto text-gray-200 mb-2" size={24} />
                              <p className="text-xs text-gray-400">No alternate views generated yet</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-dashed border-gray-300">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                  <Search className="text-gray-300" size={40} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Select a Product</h2>
                <p className="text-gray-500 mt-2 max-w-xs mx-auto">
                  Choose a product from your SQLite inventory to generate multi-angle views or search for matches.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isUploading) {
                  setShowUploadModal(false);
                  setUploadPreview(null);
                }
              }}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold">Add New Product to ERP</h3>
                <p className="text-sm text-gray-500">Upload an image to store in the SQLite database.</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Product Name</label>
                  <input 
                    type="text" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Wireless Headphones X1"
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                
                {uploadPreview ? (
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={uploadPreview} className="w-full h-full object-contain" />
                    <button 
                      onClick={() => setUploadPreview(null)}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden" 
                      accept="image/*"
                    />
                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Plus className="text-gray-400 group-hover:text-indigo-500" size={24} />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Click to upload image</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadPreview(null);
                    }}
                    className="flex-1 px-4 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!uploadPreview || !newProductName.trim() || isUploading}
                    onClick={handleSaveProduct}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isUploading ? 'Saving...' : 'Save to ERP'}
                  </button>
                </div>
              </div>
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center gap-3">
                  <Loader2 className="text-indigo-600 animate-spin" size={32} />
                  <p className="text-sm font-semibold text-indigo-600 animate-pulse">Syncing with SQLite...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Lightbox */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative z-10 w-full max-w-5xl h-full flex flex-col"
            >
              <div className="flex justify-between items-center mb-4 text-white">
                <div>
                  <h3 className="text-xl font-bold">{previewImage.title}</h3>
                  <p className="text-sm text-white/50">{selectedProduct?.name}</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => downloadImage(previewImage.url, `${selectedProduct?.name}-${previewImage.title}.png`)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2 px-4"
                  >
                    <Plus size={18} className="rotate-45" /> {/* Using Plus as a placeholder for download or similar icon if needed, but let's use a better one */}
                    <span className="text-sm font-medium">Download</span>
                  </button>
                  <button 
                    onClick={() => setPreviewImage(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center p-4">
                <img 
                  src={previewImage.url} 
                  alt={previewImage.title} 
                  className="max-w-full max-h-full object-contain shadow-2xl"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div>
  );
}
