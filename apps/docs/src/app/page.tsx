import Link from 'next/link';
import { MousePointerClick, Cloud, Lock, BarChart } from 'lucide-react';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">Welcome to RetailCraft Help Center</h1>
        <p className="text-xl text-gray-600 mb-8 leading-relaxed">
          Comprehensive documentation for managing your retail operations. Learn how to process sales, manage inventory, and track performance with our step-by-step guides.
        </p>
        <div className="flex gap-4">
          <Link href="/how-to/installation" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            Get Started
          </Link>
          <Link href="/how-to/navigation" className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            View Guides
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <MousePointerClick className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Intuitive Interface</h3>
          <p className="text-gray-600 mb-4">Learn how to navigate the POS interface quickly and efficiently.</p>
          <Link href="/how-to/navigation" className="text-blue-600 font-medium hover:text-blue-800">Learn more &rarr;</Link>
        </div>

        <div className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Cloud className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Cloud Synced</h3>
          <p className="text-gray-600 mb-4">Your data is always up to date across all devices and locations.</p>
          <Link href="/how-to/inventory" className="text-blue-600 font-medium hover:text-blue-800">Learn more &rarr;</Link>
        </div>

        <div className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Secure & Reliable</h3>
          <p className="text-gray-600 mb-4">Enterprise-grade security to keep your business data safe.</p>
          <Link href="/faq" className="text-blue-600 font-medium hover:text-blue-800">Learn more &rarr;</Link>
        </div>

        <div className="p-6 border border-gray-200 rounded-lg hover:shadow-lg transition-shadow">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
            <BarChart className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Real-time Analytics</h3>
          <p className="text-gray-600 mb-4">Track sales, inventory, and employee performance in real-time.</p>
          <Link href="/how-to/creating-orders" className="text-blue-600 font-medium hover:text-blue-800">Learn more &rarr;</Link>
        </div>
      </div>
    </div>
  );
}
