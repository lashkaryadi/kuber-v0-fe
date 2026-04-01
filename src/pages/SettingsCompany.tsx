import { useEffect, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MainLayout } from "@/components/layout/MainLayout";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Building2, FileText, CreditCard } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

export default function SettingsCompany() {
  const [form, setForm] = useState({
    companyName: "",
    gstNumber: "",
    panNumber: "",
    taxRate: 0,
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankBranch: "",
    logoUrl: "",
    signatureUrl: "",
    termsAndConditions: "",
  });

  const [logo, setLogo] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      const data = await api.getCompany();
      if (data) {
        setForm({
          companyName: data.companyName || "",
          gstNumber: data.gstNumber || "",
          panNumber: data.panNumber || "",
          taxRate: data.taxRate || 0,
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          pincode: data.pincode || "",
          bankName: data.bankName || "",
          bankAccountNumber: data.bankAccountNumber || "",
          bankIfscCode: data.bankIfscCode || "",
          bankBranch: data.bankBranch || "",
          logoUrl: data.logoUrl || "",
          signatureUrl: data.signatureUrl || "",
          termsAndConditions: data.termsAndConditions || "",
        });

        if (data.logoUrl) {
          setLogoPreview(`${BASE_URL}${data.logoUrl}`);
        }
        if (data.signatureUrl) {
          setSignaturePreview(`${BASE_URL}${data.signatureUrl}`);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load company profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignature(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoPreview("");
    setForm({ ...form, logoUrl: "" });
  };

  const removeSignature = () => {
    setSignature(null);
    setSignaturePreview("");
    setForm({ ...form, signatureUrl: "" });
  };

  const save = async () => {
    if (!form.companyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const payload: any = {
        companyName: form.companyName,
        gstNumber: form.gstNumber,
        panNumber: form.panNumber,
        taxRate: form.taxRate,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        bankName: form.bankName,
        bankAccountNumber: form.bankAccountNumber,
        bankIfscCode: form.bankIfscCode,
        bankBranch: form.bankBranch,
        termsAndConditions: form.termsAndConditions,
      };

      // Upload logo if new file selected
      if (logo) {
        try {
          const url = await api.uploadCompanyImage(logo, "logo");
          payload.logoUrl = url;
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to upload logo",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      } else if (form.logoUrl) {
        payload.logoUrl = form.logoUrl;
      }

      // Upload signature if new file selected
      if (signature) {
        try {
          const url = await api.uploadCompanyImage(signature, "signature");
          payload.signatureUrl = url;
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to upload signature",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      } else if (form.signatureUrl) {
        payload.signatureUrl = form.signatureUrl;
      }

      const success = await api.saveCompany(payload);
      if (success) {
        toast({
          title: "Success",
          description: "Company profile saved successfully!",
        });

        await loadCompany();
        setLogo(null);
        setSignature(null);
      } else {
        toast({
          title: "Error",
          description: "Failed to save company profile",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Company Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Company Settings">
      <div className="p-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your company profile used on invoices and official documents
          </p>
        </div>

        {/* Company Information */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Company Information</CardTitle>
            </div>
            <CardDescription>Basic details about your company</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="Kuber Gems Pvt Ltd"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="billing@kuber.com"
                />
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="123 Gem Street, Johri Bazaar"
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                  placeholder="Jaipur"
                />
              </div>

              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm({ ...form, state: e.target.value })
                  }
                  placeholder="Rajasthan"
                />
              </div>

              <div className="space-y-2">
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) =>
                    setForm({ ...form, pincode: e.target.value })
                  }
                  placeholder="302001"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax & Registration */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Tax & Registration</CardTitle>
            </div>
            <CardDescription>GST, PAN, and tax configuration for invoices</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>GST Number (GSTIN)</Label>
                <Input
                  value={form.gstNumber}
                  onChange={(e) =>
                    setForm({ ...form, gstNumber: e.target.value.toUpperCase() })
                  }
                  placeholder="08ABCDE1234F1Z9"
                  maxLength={15}
                />
              </div>

              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input
                  value={form.panNumber}
                  onChange={(e) =>
                    setForm({ ...form, panNumber: e.target.value.toUpperCase() })
                  }
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label>GST Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={form.taxRate}
                  onChange={(e) =>
                    setForm({ ...form, taxRate: Number(e.target.value) })
                  }
                  placeholder="18"
                  min={0}
                  max={100}
                />
                <p className="text-xs text-muted-foreground">
                  Split as CGST ({(form.taxRate / 2).toFixed(1)}%) + SGST ({(form.taxRate / 2).toFixed(1)}%)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Bank Details</CardTitle>
            </div>
            <CardDescription>Bank account details displayed on invoices</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={form.bankName}
                  onChange={(e) =>
                    setForm({ ...form, bankName: e.target.value })
                  }
                  placeholder="State Bank of India"
                />
              </div>

              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={form.bankAccountNumber}
                  onChange={(e) =>
                    setForm({ ...form, bankAccountNumber: e.target.value })
                  }
                  placeholder="1234567890123456"
                />
              </div>

              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input
                  value={form.bankIfscCode}
                  onChange={(e) =>
                    setForm({ ...form, bankIfscCode: e.target.value.toUpperCase() })
                  }
                  placeholder="SBIN0001234"
                />
              </div>

              <div className="space-y-2">
                <Label>Branch</Label>
                <Input
                  value={form.bankBranch}
                  onChange={(e) =>
                    setForm({ ...form, bankBranch: e.target.value })
                  }
                  placeholder="Johri Bazaar Branch"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logos & Signatures */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Logo & Signature</CardTitle>
            <CardDescription>Upload your company logo and authorized signature for invoices</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload */}
              <div className="space-y-3">
                <Label>Company Logo</Label>
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="h-32 w-32 rounded border object-contain bg-white"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeLogo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="logo-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-6 hover:border-primary transition-colors text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload logo
                      </p>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Signature Upload */}
              <div className="space-y-3">
                <Label>Authorized Signature</Label>
                {signaturePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={signaturePreview}
                      alt="Signature"
                      className="h-32 w-32 rounded border object-contain bg-white"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeSignature}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="signature-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-6 hover:border-primary transition-colors text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload signature
                      </p>
                    </div>
                    <input
                      id="signature-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Invoice Terms & Conditions</CardTitle>
            <CardDescription>Default terms printed on every invoice</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.termsAndConditions}
              onChange={(e) =>
                setForm({ ...form, termsAndConditions: e.target.value })
              }
              placeholder="1. Goods once sold will not be taken back.&#10;2. Subject to Jaipur jurisdiction.&#10;3. E. & O.E."
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={save} disabled={saving || !form.companyName} size="lg">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Company Profile"
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
