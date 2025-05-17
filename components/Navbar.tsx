import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-white dark:bg-gray-900 shadow-md">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <Image 
              src="/compliance-logo.svg" 
              alt="EU Compliance Checker Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-xl font-semibold">EU Compliance Checker</span>
        </Link>
      </div>
    </nav>
  );
};

export default Navbar; 