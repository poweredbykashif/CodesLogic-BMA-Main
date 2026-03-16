import React, { useState } from 'react';
import { IconCopy, IconCheck } from '../components/Icons';

const GuideAddProject: React.FC = () => {
    const [copied1, setCopied1] = useState(false);
    const [copied2, setCopied2] = useState(false);

    const briefOnlyPrompt = `I will provide you with project details for a logo design. Your task is to rewrite and organize the information into a clear, professional brief.

Improve readability and structure while keeping the original meaning. Make the brief easier to understand by slightly clarifying explanations where needed (without changing the intent).

Formatting Guidelines:
- Highlight important sections in bold. Keep the answers in normal text under each section.
- If any of the fields below are included, use them exactly as section headings.
- If some fields are missing, organize the information according to standard logo design brief structure used in the design industry.
- Always provide the final output inside a plain Markdown code block.

Use these sections if they are present in the details:
- Industry (If you’re ordering for a business, what’s your industry?)
- Logo Title
- Slogan
- Preferred Colors
- Logo Brief
- Reference Logos / Images
- Target Audience

Ensure the final brief is clean, structured, and easy for a designer to quickly understand.

Below is the full brief:

REPLACE THIS TEXT WITH BRIEF`;

    const briefAndCommentsPrompt = `I will provide you with project details for a logo design. Your task is to rewrite and organize the information into a clear, professional brief.

Improve readability and structure while keeping the original meaning. Make the brief easier to understand by slightly clarifying explanations where needed (without changing the intent).

Formatting Guidelines:
- Highlight important sections in bold. Keep the answers in normal text under each section.
- If any of the fields below are included, use them exactly as section headings.
- If some fields are missing, organize the information according to standard logo design brief structure used in the design industry.
- Always provide the final output inside a plain Markdown code block.

Use these sections if they are present in the details:
- Industry (If you’re ordering for a business, what’s your industry?)
- Logo Title
- Slogan
- Preferred Colors
- Logo Brief
- Reference Logos / Images
- Target Audience

Ensure the final brief is clean, structured, and easy for a designer to quickly understand.

Below is the full brief:

REPLACE THIS TEXT WITH BRIEF 

Below are Additional Comments:

REPLACE THIS TEXT WITH ADDITIONAL COMMENTS`;

    const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full items-start justify-start p-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-6">Add Project - Documentation</h1>

            {/* YouTube Video Player - Fixed Visibility */}
            <div className="w-full mb-10 overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#111] z-10 relative" style={{ minHeight: '400px' }}>
                <div className="w-full relative pt-[56.25%]"> {/* Standard 16:9 Aspect Ratio */}
                    <iframe
                        className="absolute top-0 left-0 w-full h-full block opacity-100"
                        src="https://www.youtube.com/embed/M7lc1UVf-VE?rel=0&modestbranding=1"
                        title="Project Documentation Video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                    ></iframe>
                </div>
            </div>

            <div className="w-full text-gray-400 space-y-4 text-lg leading-relaxed mix-blend-plus-lighter pb-12">
                <p>
                    Projects are the core entity in the ecosystem. To start a new project, navigate to the Projects tab and click the "New Project" button located at the top right corner.
                </p>

                {/* Section 1: Brief Only */}
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Prompt - Incase Of Brief Only</h2>
                <div className="relative group mb-12">
                    <div className="absolute bottom-0 right-0 p-3 z-10">
                        <button
                            onClick={() => handleCopy(briefOnlyPrompt, setCopied1)}
                            className={`p-2 rounded-xl transition-all duration-300 ${copied1
                                ? 'bg-brand-success/20 text-brand-success border border-brand-success/30'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                            title="Copy to clipboard"
                        >
                            {copied1 ? <IconCheck size={18} /> : <IconCopy size={18} />}
                        </button>
                    </div>
                    <pre className="bg-black/40 border border-white/[0.02] rounded-2xl p-6 text-sm text-gray-400 whitespace-pre-wrap break-words shadow-[inset_0_4px_16px_rgba(0,0,0,0.7),0_1px_rgba(255,255,255,0.02)] font-mono relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
                        <code>{briefOnlyPrompt}</code>
                    </pre>
                </div>

                {/* Section 2: Industry Details */}
                <h2 className="text-2xl font-bold text-white mt-8 mb-4">Prompt - Incase Of Brief And Additional Comments</h2>
                <div className="relative group mb-16">
                    <div className="absolute bottom-0 right-0 p-3 z-10">
                        <button
                            onClick={() => handleCopy(briefAndCommentsPrompt, setCopied2)}
                            className={`p-2 rounded-xl transition-all duration-300 ${copied2
                                ? 'bg-brand-success/20 text-brand-success border border-brand-success/30'
                                : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                            title="Copy to clipboard"
                        >
                            {copied2 ? <IconCheck size={18} /> : <IconCopy size={18} />}
                        </button>
                    </div>
                    <pre className="bg-black/40 border border-white/[0.02] rounded-2xl p-6 text-sm text-gray-400 whitespace-pre-wrap break-words shadow-[inset_0_4px_16px_rgba(0,0,0,0.7),0_1px_rgba(255,255,255,0.02)] font-mono relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
                        <code>{briefAndCommentsPrompt}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
};

export default GuideAddProject;
