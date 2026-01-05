
"use client";

import { useState } from 'react';
import GeneralSettings from '@/components/settings/GeneralSettings';
import StoreSettings from '@/components/settings/StoreSettings';
import TeamSettings from '@/components/settings/TeamSettings';
import RolesSettings from '@/components/settings/RolesSettings';
import TaxesDiscountsSettings from '@/components/settings/TaxesDiscountsSettings';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'General' },
        { id: 'locations', label: 'Locations' },
        { id: 'team', label: 'Team' },
        { id: 'roles', label: 'Roles & Permissions' },
        { id: 'taxes', label: 'Taxes & Discounts' },
    ];

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                ${activeTab === tab.id
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === 'general' && <GeneralSettings />}
                {activeTab === 'locations' && <StoreSettings />}
                {activeTab === 'team' && <TeamSettings />}
                {activeTab === 'roles' && <RolesSettings />}
                {activeTab === 'taxes' && <TaxesDiscountsSettings />}
            </div>
        </div>
    );
}



