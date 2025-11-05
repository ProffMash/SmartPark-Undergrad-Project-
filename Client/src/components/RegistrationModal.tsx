import React, { useState } from "react";
import { User, Mail, Lock, Phone, Car, Hash, Eye, EyeOff, Check } from "lucide-react";
import { registerUser } from "../API/authApi";

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess?: () => void;
}

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "user",
  phone: "",
  vehicle_number: "",
  vehicle_model: "",
};

export const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose, onRegisterSuccess }) => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: 'Too short' });
  const [showPassword, setShowPassword] = useState(false);

  const evaluatePassword = (pw: string) => {
    const checks = {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
    const score = Object.values(checks).filter(Boolean).length;
    let label = 'Very weak';
    if (pw.length === 0) label = 'Empty';
    else if (score <= 1) label = 'Very weak';
    else if (score === 2) label = 'Weak';
    else if (score === 3) label = 'Medium';
    else if (score >= 4) label = 'Strong';
    return { checks, score, label } as any;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    setForm({ ...form, [name]: value });
    if (name === 'password') {
      const res = evaluatePassword(value);
      setPasswordStrength({ score: res.score, label: res.label });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // client-side enforcement: require at least Medium strength
    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password (at least Medium strength).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
    // Use centralized auth API helper that posts to `auth/register/`
    await registerUser(form as any);
      // success
      setForm(initialForm);
      if (onRegisterSuccess) onRegisterSuccess();
      onClose();
    } catch (err: any) {
      // Normalize axios / network errors into a readable message
      let message = 'Registration failed. Please try again.';
      if (err?.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') message = data;
        else if (data.detail) message = data.detail;
        else if (data.error) message = data.error;
        else if (data.non_field_errors) message = Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : String(data.non_field_errors);
        else {
          // format field errors like { email: ["..."], phone: ["..."] }
          const parts: string[] = [];
          for (const k in data) {
            const v = data[k];
            if (Array.isArray(v)) parts.push(`${k}: ${v.join(' ')}`);
            else parts.push(`${k}: ${String(v)}`);
          }
          if (parts.length) message = parts.join(' | ');
        }
      } else if (err?.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const pwEval = evaluatePassword(form.password);

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0">
          {/* Left: visual panel */}
          <div className="hidden md:flex items-center justify-center bg-blue-600 p-8">
            <div className="text-center text-white">
              <Car className="mx-auto mb-4 h-12 w-12 opacity-90" />
              <h3 className="text-2xl font-bold">Join SmartPark</h3>
              <p className="mt-2 text-sm opacity-90">Create an account to manage bookings and payments.</p>
            </div>
          </div>

          {/* Right: form */}
          <div className="p-6 md:p-8 flex flex-col min-h-0">
            {/* Mobile top banner (collapses the left visual into a compact top banner) */}
            <div className="md:hidden mb-4 flex items-center justify-between bg-blue-600 text-white rounded-lg p-3">
              <div className="flex items-center space-x-3">
                <Car className="h-8 w-8" />
                <div>
                  <h3 className="text-lg font-bold leading-tight">Join SmartPark</h3>
                  <p className="text-xs opacity-90">Create an account to manage bookings and payments.</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" className="text-white hover:opacity-90">✕</button>
            </div>

            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Create an account</h2>
              <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form id="regForm" onSubmit={handleSubmit} className="flex flex-col space-y-4 flex-1 overflow-auto pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Full name</label>
                  <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 min-w-0">
                    <User className="mr-2 text-slate-400" />
                    <input name="name" value={form.name} onChange={handleChange} placeholder="Jane Doe" required className="w-full outline-none text-sm text-slate-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Phone</label>
                    <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 min-w-0">
                    <Phone className="mr-2 text-slate-400" />
                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="+1 555 01234" required className="w-full outline-none text-sm text-slate-700" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email</label>
                  <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 min-w-0">
                    <Mail className="mr-2 text-slate-400" />
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required className="w-full outline-none text-sm text-slate-700 min-w-0" />
                  </div>
                </div>

                {/* placeholder to keep two-column rhythm on larger screens */}
                <div className="hidden sm:block" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Role</label>
                <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300">
                  <User className="mr-2 text-slate-400" />
                  <select name="role" value={form.role} onChange={handleChange} className="w-full outline-none text-sm text-slate-700 bg-transparent">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Vehicle number</label>
                  <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300">
                    <Hash className="mr-2 text-slate-400" />
                    <input name="vehicle_number" value={form.vehicle_number} onChange={handleChange} placeholder="ABC-1234" required className="w-full outline-none text-sm text-slate-700" />
                  </div>
                </div>
                <div className="hidden sm:block" />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Vehicle model</label>
                <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300">
                  <Car className="mr-2 text-slate-400" />
                  <input name="vehicle_model" value={form.vehicle_model} onChange={handleChange} placeholder="Toyota Corolla 2019" required className="w-full outline-none text-sm text-slate-700" />
                </div>
              </div>

              {/* Password moved to the bottom to avoid layout shifts */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Password</label>
                  <div className="flex items-center bg-white border rounded-md shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-blue-300 min-w-0">
                    <Lock className="mr-2 text-slate-400" />
                    <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Choose a secure password" required className="w-full outline-none text-sm text-slate-700 min-w-0" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                <div className="mt-2 w-full">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${pwEval.score <= 1 ? 'bg-red-400 w-1/5' : pwEval.score === 2 ? 'bg-orange-400 w-2/5' : pwEval.score === 3 ? 'bg-yellow-400 w-3/5' : pwEval.score === 4 ? 'bg-emerald-400 w-4/5' : 'bg-green-500 w-full'}`}
                    />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Strength: <span className="font-medium text-slate-700">{pwEval.label}</span></div>

                  <ul className="mt-2 space-y-1 text-xs w-full">
                    <li className={`flex items-center ${pwEval.checks.length ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <Check className={`mr-2 h-4 w-4 ${pwEval.checks.length ? 'text-emerald-600' : 'text-slate-300'}`} /> Minimum 8 characters
                    </li>
                    <li className={`flex items-center ${pwEval.checks.upper ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <Check className={`mr-2 h-4 w-4 ${pwEval.checks.upper ? 'text-emerald-600' : 'text-slate-300'}`} /> Uppercase letter
                    </li>
                    <li className={`flex items-center ${pwEval.checks.lower ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <Check className={`mr-2 h-4 w-4 ${pwEval.checks.lower ? 'text-emerald-600' : 'text-slate-300'}`} /> Lowercase letter
                    </li>
                    <li className={`flex items-center ${pwEval.checks.number ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <Check className={`mr-2 h-4 w-4 ${pwEval.checks.number ? 'text-emerald-600' : 'text-slate-300'}`} /> Number
                    </li>
                    <li className={`flex items-center ${pwEval.checks.special ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <Check className={`mr-2 h-4 w-4 ${pwEval.checks.special ? 'text-emerald-600' : 'text-slate-300'}`} /> Special character
                    </li>
                  </ul>
                </div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </form>

            {/* Sticky footer so actions are always visible while scrolling */}
            <div className="sticky bottom-0 mt-2 md:mt-4 bg-white/70 backdrop-blur-sm py-3">
              <div className="max-w-full flex items-center justify-between px-0 md:px-0">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700">Cancel</button>
                <button type="submit" form="regForm" disabled={loading || passwordStrength.score < 3} className="px-5 py-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60">
                  {loading ? "Registering..." : "Create account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
