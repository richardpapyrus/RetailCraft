import Image from 'next/image';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

export type Step = {
    title: string;
    content: React.ReactNode;
    image?: string;
    imageAlt?: string;
    alert?: {
        type: 'info' | 'warning' | 'tip';
        message: string;
    };
};

interface StepByStepProps {
    title: string;
    description?: string;
    steps: Step[];
}

export function StepByStep({ title, description, steps }: StepByStepProps) {
    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-12 border-b border-gray-200 pb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
                {description && (
                    <p className="text-xl text-gray-600 leading-relaxed">{description}</p>
                )}
            </div>

            <div className="space-y-16">
                {steps.map((step, index) => (
                    <div key={index} className="relative pl-8 md:pl-0">
                        {/* Step Number Badge */}
                        <div className="hidden md:flex absolute -left-16 top-0 w-10 h-10 rounded-full bg-blue-600 text-white items-center justify-center font-bold text-lg">
                            {index + 1}
                        </div>

                        <div className="md:border-l-2 border-gray-200 md:pl-10 pb-8">
                            <div className="flex md:hidden absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-600 text-white items-center justify-center font-bold text-sm mb-4">
                                {index + 1}
                            </div>

                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h2>

                            <div className="prose prose-gray max-w-none text-gray-600 mb-6">
                                {step.content}
                            </div>

                            {step.alert && (
                                <div className={cn(
                                    "flex items-start gap-3 p-4 rounded-lg mb-6",
                                    step.alert.type === 'info' && "bg-blue-50 text-blue-800",
                                    step.alert.type === 'warning' && "bg-yellow-50 text-yellow-800",
                                    step.alert.type === 'tip' && "bg-green-50 text-green-800",
                                )}>
                                    {step.alert.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                    {step.alert.type === 'warning' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                    {step.alert.type === 'tip' && <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                                    <span className="text-sm font-medium">{step.alert.message}</span>
                                </div>
                            )}

                            {step.image && (
                                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md bg-white">
                                    {/* Aspect ratio container - simplified for now, assuming images will be handled by next/image properly or just img tags if external */}
                                    {/* In a real app we'd use next/image with width/height or fill. 
                       For this prototype, we'll try to use a standard img if it's a generated placeholder or similar. 
                       But user requested next/image usage in standard Next.js apps. 
                       We will use a styled div wrapper for the image. */}
                                    <div className="relative w-full h-auto bg-gray-100 flex items-center justify-center min-h-[300px]">
                                        {/* Using a standard img for now to handle variety of sources easily in this mockup phase, 
                          or we can use Image if we have local assets. 
                          Let's use a standard img tag for simplicity with external placeholders, 
                          but style it to look professional. */}
                                        <img
                                            src={step.image}
                                            alt={step.imageAlt || step.title}
                                            className="w-full h-auto object-cover block"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
