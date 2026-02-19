// src/pages/admin/SettingsAdmin.tsx (System settings)
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function SettingsAdmin() {
  const [serviceFee, setServiceFee] = useState(10); // example setting

  const handleSaveSettings = async () => {
    // Implement saving to a 'settings' table
    const { error } = await supabase
      .from("settings")
      .upsert({ id: "general", service_fee: serviceFee });

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">System Settings</h1>

        <Card className="bg-slate-900/70 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <label className="text-white w-32">Service Fee (%)</label>
              <Input
                type="number"
                value={serviceFee}
                onChange={(e) => setServiceFee(Number(e.target.value))}
                className="bg-slate-800 text-white w-32"
              />
            </div>

            {/* Add more settings here, e.g. categories, email templates, etc. */}

            <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}