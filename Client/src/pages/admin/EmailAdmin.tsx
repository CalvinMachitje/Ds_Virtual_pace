// src/pages/admin/EmailAdmin.tsx
import React from 'react';

export default function EmailAdmin() {
  return (
    <div className="p-6 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Email Administration</h1>
      
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <p className="text-slate-300 mb-4">
          Manage email templates, newsletters, user communications, and notifications.
        </p>
        
        {/* Placeholder for future content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Templates</h2>
            <p className="text-slate-400">Coming soon: create/edit email templates</p>
          </div>
          
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Queue & Sending</h2>
            <p className="text-slate-400">Coming soon: view queued emails & send bulk</p>
          </div>
        </div>
      </div>
    </div>
  );
}