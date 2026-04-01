import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { getCompany } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Download, Printer } from "lucide-react";

interface InvoiceItem {
  serialNumber: string;
  category: string;
  hsnCode?: string;
  shapes?: Array<{ shapeName: string; pieces: number; weight: number }>;
  soldPieces: number;
  soldWeight: number;
  weightUnit: string;
  pricePerCarat: number;
  lineTotal: number;
}

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstin?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  cgstRate: number;
  sgstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
  issueDate: string;
  paymentTerms?: string;
  notes?: string;
  placeOfSupply?: string;
  qrCodeDataUrl?: string;
}

interface CompanyData {
  companyName?: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  taxRate?: number;
  signatureUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankBranch?: string;
  termsAndConditions?: string;
}

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  const convertBelowHundred = (n: number) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };

  const convertBelowThousand = (n: number) => {
    if (n < 100) return convertBelowHundred(n);
    return (
      ones[Math.floor(n / 100)] +
      " Hundred" +
      (n % 100 ? " and " + convertBelowHundred(n % 100) : "")
    );
  };

  let result = "";
  if (num >= 10000000) {
    result += convertBelowThousand(Math.floor(num / 10000000)) + " Crore ";
    num %= 10000000;
  }
  if (num >= 100000) {
    result += convertBelowHundred(Math.floor(num / 100000)) + " Lakh ";
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertBelowHundred(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }
  if (num > 0) {
    result += convertBelowThousand(num);
  }

  return result.trim();
}

export default function InvoicePreview() {
  const { soldId, id } = useParams<{ soldId?: string; id?: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!soldId && !id) return;

    const fetchData = async () => {
      try {
        let invoiceRes;
        if (id) {
          invoiceRes = await api.getInvoiceById(id);
        } else if (soldId) {
          invoiceRes = await api.getInvoiceBySold(soldId);
        }

        const companyRes = await getCompany();

        const invoiceData = invoiceRes?.data || invoiceRes;
        setInvoice(invoiceData);
        setCompany(companyRes);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [soldId, id]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!invoice?._id) return;
    const result = await api.downloadInvoicePDF(invoice._id);
    if (!result.success) {
      alert("Failed to download PDF");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-xl text-muted-foreground">{error || "Invoice not found"}</p>
        <Button onClick={() => navigate("/sold")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sold Items
        </Button>
      </div>
    );
  }

  const formatINR = (amount: number) =>
    `$ ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;  // Standardized to USD format

  const companyAddress = [
    company?.address,
    company?.city,
    company?.state,
    company?.pincode ? `- ${company.pincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Action Bar */}
      <div className="max-w-[210mm] mx-auto mb-4 px-4 print:hidden">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/sold")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sales
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Page - A4 Sized */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-xl print:shadow-none print:max-w-none overflow-hidden">
        <div style={{ minHeight: "297mm" }} className="flex flex-col">
          {/* Top Accent Bar */}
          <div className="h-2 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />

          <div className="p-8 print:p-6 flex-1 flex flex-col">
            {/* Header: Company + Invoice Meta */}
            <div className="flex justify-between items-start mb-6">
              {/* Company Block */}
              <div className="flex items-start gap-4">
                {company?.logoUrl && (
                  <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white flex items-center justify-center">
                    <img
                      src={`${BASE_URL}${company.logoUrl}`}
                      alt="Logo"
                      className="max-h-14 max-w-14 object-contain"
                    />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                    {company?.companyName || "Company Name"}
                  </h2>
                  {companyAddress && (
                    <p className="text-xs text-gray-500 mt-0.5 max-w-[280px]">{companyAddress}</p>
                  )}
                  <div className="flex gap-4 mt-1">
                    {company?.phone && (
                      <p className="text-xs text-gray-500">
                        {company.phone}
                      </p>
                    )}
                    {company?.email && (
                      <p className="text-xs text-gray-500">
                        {company.email}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1">
                    {company?.gstNumber && (
                      <p className="text-xs font-semibold text-gray-700">
                        GSTIN: {company.gstNumber}
                      </p>
                    )}
                    {company?.panNumber && (
                      <p className="text-xs text-gray-600">
                        PAN: {company.panNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Invoice Badge */}
              <div className="text-right flex-shrink-0">
                <div className="inline-block">
                  <h1 className="text-2xl font-bold tracking-wider text-amber-700 uppercase">
                    Tax Invoice
                  </h1>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    Under Section 31 of CGST/SGST Act
                  </p>
                </div>
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Invoice No</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div className="mt-2 space-y-0.5 text-right">
                  <p className="text-xs text-gray-500">
                    Date:{" "}
                    <span className="text-gray-700 font-medium">
                      {new Date(invoice.issueDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </p>
                  {invoice.placeOfSupply && (
                    <p className="text-xs text-gray-500">
                      Place of Supply:{" "}
                      <span className="text-gray-700 font-medium">{invoice.placeOfSupply}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-b border-gray-200 mb-5" />

            {/* Bill To */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-widest mb-2">
                Bill To
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {invoice.customerName}
                  </p>
                  {invoice.customerAddress && (
                    <p className="text-xs text-gray-600 mt-0.5">{invoice.customerAddress}</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  {invoice.customerPhone && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">Phone:</span> {invoice.customerPhone}
                    </p>
                  )}
                  {invoice.customerEmail && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">Email:</span> {invoice.customerEmail}
                    </p>
                  )}
                  {invoice.customerGstin && (
                    <p className="text-xs font-semibold text-gray-700">
                      GSTIN: {invoice.customerGstin}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-5 flex-1">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
                    <th className="px-3 py-2.5 text-left w-8 font-medium rounded-tl-lg">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium">
                      Description
                    </th>
                    <th className="px-3 py-2.5 text-center w-14 font-medium">
                      HSN
                    </th>
                    <th className="px-3 py-2.5 text-right w-16 font-medium">
                      Qty
                    </th>
                    <th className="px-3 py-2.5 text-right w-20 font-medium">
                      Weight
                    </th>
                    <th className="px-3 py-2.5 text-right w-20 font-medium">
                      Rate/ct
                    </th>
                    <th className="px-3 py-2.5 text-right w-24 font-medium rounded-tr-lg">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        } hover:bg-amber-50/30 transition-colors border-b border-gray-100`}
                    >
                      <td className="px-3 py-2.5 text-gray-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-gray-900">
                          {item.serialNumber}
                          <span className="text-gray-400 font-normal"> - </span>
                          <span className="text-gray-600 font-medium">{item.category}</span>
                        </div>
                        {item.shapes && item.shapes.length > 0 && (
                          <div className="text-[10px] text-gray-400 mt-0.5 flex gap-2 flex-wrap">
                            {item.shapes.map((s, si) => (
                              <span key={si} className="bg-gray-100 px-1.5 py-0.5 rounded">
                                {s.shapeName}: {s.pieces}pcs / {s.weight}ct
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">
                        {item.hsnCode || "7103"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">
                        {item.soldPieces}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">
                        {item.soldWeight} {item.weightUnit}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">
                        {item.pricePerCarat > 0
                          ? formatINR(item.pricePerCarat)
                          : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                        {formatINR(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-5">
              <div className="w-80">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between px-4 py-2 text-xs bg-white">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium text-gray-700">{formatINR(invoice.subtotal)}</span>
                  </div>

                  {invoice.taxRate > 0 && (
                    <>
                      <div className="flex justify-between px-4 py-2 text-xs border-t border-gray-100 bg-white">
                        <span className="text-gray-500">
                          CGST @ {invoice.cgstRate}%
                        </span>
                        <span className="text-gray-600">{formatINR(invoice.cgstAmount)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2 text-xs border-t border-gray-100 bg-white">
                        <span className="text-gray-500">
                          SGST @ {invoice.sgstRate}%
                        </span>
                        <span className="text-gray-600">{formatINR(invoice.sgstAmount)}</span>
                      </div>
                    </>
                  )}

                  {invoice.discount > 0 && (
                    <div className="flex justify-between px-4 py-2 text-xs border-t border-gray-100 bg-white">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-red-500 font-medium">
                        -{formatINR(invoice.discount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between px-4 py-3 text-sm font-bold bg-gradient-to-r from-amber-600 to-amber-700 text-white">
                    <span>TOTAL</span>
                    <span>{formatINR(invoice.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount in Words */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-6">
              <p className="text-xs">
                <span className="font-semibold text-amber-800">Amount in Words: </span>
                <span className="text-gray-700">
                  {numberToWords(Math.floor(invoice.total))} Dollars Only
                </span>
              </p>
            </div>

            {/* Bottom Section: QR + Bank + Signature */}
            <div className="grid grid-cols-3 gap-6 mt-auto">
              {/* QR Code */}
              <div className="flex flex-col items-center justify-end">
                {invoice.qrCodeDataUrl && (
                  <>
                    <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                      <img
                        src={invoice.qrCodeDataUrl}
                        alt="Invoice QR Code"
                        className="w-20 h-20"
                      />
                    </div>
                    <p className="text-[8px] text-gray-400 mt-1.5 text-center">
                      Scan for invoice details
                    </p>
                  </>
                )}
              </div>

              {/* Bank Details */}
              <div className="flex flex-col justify-end">
                {company?.bankName && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-widest mb-1.5">
                      Bank Details
                    </p>
                    <div className="text-[11px] space-y-0.5">
                      <p className="text-gray-700 font-medium">{company.bankName}</p>
                      {company.bankAccountNumber && (
                        <p className="text-gray-600">
                          <span className="text-gray-400">A/C:</span> {company.bankAccountNumber}
                        </p>
                      )}
                      {company.bankIfscCode && (
                        <p className="text-gray-600">
                          <span className="text-gray-400">IFSC:</span> {company.bankIfscCode}
                        </p>
                      )}
                      {company.bankBranch && (
                        <p className="text-gray-600">
                          <span className="text-gray-400">Branch:</span> {company.bankBranch}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Signature */}
              <div className="flex flex-col items-end justify-end">
                <div className="text-center">
                  {company?.signatureUrl ? (
                    <div className="mb-1">
                      <img
                        src={`${BASE_URL}${company.signatureUrl}`}
                        alt="Authorized Signature"
                        className="h-14 w-auto mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="h-10 mb-1" />
                  )}
                  <div className="border-t-2 border-gray-800 w-40 pt-1.5">
                    <p className="text-[10px] font-bold text-gray-700">
                      Authorized Signatory
                    </p>
                    <p className="text-[9px] text-gray-500 font-medium">
                      {company?.companyName || ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            {company?.termsAndConditions && (
              <div className="mt-5 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  Terms & Conditions
                </p>
                <p className="text-[10px] text-gray-500 whitespace-pre-line leading-relaxed">
                  {company.termsAndConditions}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-100 text-center">
              <p className="text-[9px] text-gray-400">
                This is a computer-generated invoice and does not require a
                physical signature.
              </p>
            </div>
          </div>

          {/* Bottom Accent Bar */}
          <div className="h-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
