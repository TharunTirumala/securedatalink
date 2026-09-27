import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertTriangle, Shield, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

interface CustomTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTelemetrySubmitted?: (result: any) => void;
}

interface TelemetryFormData {
  deviceId: string;
  latitude: string;
  longitude: string;
  altitude: string;
  speed: string;
  heading: string;
  timestamp: string;
  battery: string;
  flightMode: string;
}

interface FormErrors {
  deviceId?: string;
  latitude?: string;
  longitude?: string;
  altitude?: string;
  speed?: string;
  heading?: string;
  timestamp?: string;
  battery?: string;
  flightMode?: string;
}

export const CustomTelemetryModal: React.FC<CustomTelemetryModalProps> = ({
  isOpen,
  onClose,
  onTelemetrySubmitted
}) => {
  const getDefaultTimestamp = () => (Date.now() / 1000).toFixed(3);

  const initialFormState: TelemetryFormData = {
    deviceId: 'CUSTOM-001',
    latitude: '37.7749',
    longitude: '-122.4194',
    altitude: '240.5',
    speed: '28.0',
    heading: '145.0',
    timestamp: getDefaultTimestamp(),
    battery: '98',
    flightMode: 'AUTONOMOUS_NAV'
  };

  const [formData, setFormData] = useState<TelemetryFormData>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: FormErrors = {};

    // Device ID
    if (!formData.deviceId.trim()) {
      errs.deviceId = 'Device ID is required';
    } else if (formData.deviceId.length > 64) {
      errs.deviceId = 'Device ID cannot exceed 64 characters';
    }

    // Latitude [-90, 90]
    const lat = parseFloat(formData.latitude);
    if (!formData.latitude.trim() || isNaN(lat)) {
      errs.latitude = 'Valid latitude is required';
    } else if (lat < -90 || lat > 90) {
      errs.latitude = 'Latitude must be between -90.0 and 90.0';
    }

    // Longitude [-180, 180]
    const lon = parseFloat(formData.longitude);
    if (!formData.longitude.trim() || isNaN(lon)) {
      errs.longitude = 'Valid longitude is required';
    } else if (lon < -180 || lon > 180) {
      errs.longitude = 'Longitude must be between -180.0 and 180.0';
    }

    // Altitude [-500, 50000]
    const alt = parseFloat(formData.altitude);
    if (!formData.altitude.trim() || isNaN(alt)) {
      errs.altitude = 'Valid altitude is required';
    } else if (alt < -500 || alt > 50000) {
      errs.altitude = 'Altitude must be between -500 and 50,000 m';
    }

    // Speed [0, 3000]
    const spd = parseFloat(formData.speed);
    if (!formData.speed.trim() || isNaN(spd)) {
      errs.speed = 'Valid speed is required';
    } else if (spd < 0 || spd > 3000) {
      errs.speed = 'Speed must be between 0 and 3,000 m/s';
    }

    // Heading [0, 360]
    const hdg = parseFloat(formData.heading);
    if (!formData.heading.trim() || isNaN(hdg)) {
      errs.heading = 'Valid heading is required';
    } else if (hdg < 0 || hdg > 360) {
      errs.heading = 'Heading must be between 0 and 360 deg';
    }

    // Timestamp
    const ts = parseFloat(formData.timestamp);
    if (!formData.timestamp.trim() || isNaN(ts) || ts <= 0) {
      errs.timestamp = 'Valid positive Unix timestamp is required';
    }

    // Battery [0, 100]
    if (formData.battery.trim()) {
      const bat = parseFloat(formData.battery);
      if (isNaN(bat) || bat < 0 || bat > 100) {
        errs.battery = 'Battery must be between 0 and 100%';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleInputChange = (field: keyof TelemetryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSetCurrentTime = () => {
    handleInputChange('timestamp', (Date.now() / 1000).toFixed(3));
  };

  const handleReset = () => {
    setFormData({
      ...initialFormState,
      timestamp: getDefaultTimestamp()
    });
    setErrors({});
    setSubmissionResult(null);
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        device_id: formData.deviceId.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        altitude: parseFloat(formData.altitude),
        speed: parseFloat(formData.speed),
        heading: parseFloat(formData.heading),
        timestamp: parseFloat(formData.timestamp),
        battery_pct: formData.battery.trim() ? parseFloat(formData.battery) : 100,
        flight_mode: formData.flightMode
      };

      const result = await api.ingestPacket(payload);
      setSubmissionResult(result);
      if (onTelemetrySubmitted) {
        onTelemetrySubmitted(result);
      }
    } catch (err: any) {
      setServerError(err?.message || 'Failed to submit custom telemetry packet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmissionResult(null);
    setServerError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-wide">
                SEND CUSTOM TELEMETRY
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Cryptographically seal and ingest live tactical telemetry packet
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body or Result Display */}
        <div className="p-6">
          {serverError && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Transmission Error: </span>
                {serverError}
              </div>
            </div>
          )}

          {submissionResult ? (
            /* Result Panel */
            <div className="space-y-5">
              <div className={`p-4 rounded-xl border ${
                submissionResult.action === 'ACCEPTED'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/80 border-rose-200 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    {submissionResult.action === 'ACCEPTED' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-bold tracking-tight">
                        Pipeline Outcome: {submissionResult.action}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Classification: <span className="font-bold font-mono text-slate-900">{submissionResult.classification}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono border ${
                    submissionResult.action === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {submissionResult.action}
                  </span>
                </div>
              </div>

              {/* Trust Score & Latency */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block font-mono">
                    TRUST ASSESSMENT
                  </span>
                  <div className="flex items-baseline space-x-1.5 mt-1">
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {submissionResult.trust_score}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full ${
                        submissionResult.trust_score >= 80 ? 'bg-emerald-500' :
                        submissionResult.trust_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${submissionResult.trust_score}%` }}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block font-mono">
                    SECURITY LATENCY & ID
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                    {submissionResult.latency_ms} ms
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate mt-1" title={submissionResult.packet_id}>
                    {submissionResult.packet_id}
                  </div>
                </div>
              </div>

              {/* 4 Security Stages Breakdown */}
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-500 block mb-2 font-mono">
                  10-STAGE VERIFICATION VERDICT
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Freshness / Nonce</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      submissionResult.freshness_status === 'PASS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {submissionResult.freshness_status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-slate-600 font-medium">AES-256-GCM Auth</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      submissionResult.auth_status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {submissionResult.auth_status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-slate-600 font-medium">ECDSA P-256 Sig</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      submissionResult.sig_status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {submissionResult.sig_status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                    <span className="text-slate-600 font-medium">SHA-256 Integrity</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      submissionResult.integrity_status === 'PASS' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {submissionResult.integrity_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSubmissionResult(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  Send Another Packet
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Close & View Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Device ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Tactical Device ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                    <button
                      type="button"
                      onClick={() => handleInputChange('deviceId', 'CUSTOM-001')}
                      className="hover:text-indigo-600 underline cursor-pointer"
                    >
                      CUSTOM-001
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleInputChange('deviceId', 'UAV-001')}
                      className="hover:text-indigo-600 underline cursor-pointer"
                    >
                      UAV-001
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={formData.deviceId}
                  onChange={(e) => handleInputChange('deviceId', e.target.value)}
                  placeholder="e.g. CUSTOM-001, UAV-001"
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                    errors.deviceId
                      ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                  }`}
                />
                {errors.deviceId && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.deviceId}</p>
                )}
              </div>

              {/* Row 2: Latitude & Longitude */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Latitude (-90 to 90) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => handleInputChange('latitude', e.target.value)}
                    placeholder="37.7749"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.latitude
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.latitude && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.latitude}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Longitude (-180 to 180) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => handleInputChange('longitude', e.target.value)}
                    placeholder="-122.4194"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.longitude
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.longitude && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.longitude}</p>
                  )}
                </div>
              </div>

              {/* Row 3: Altitude & Speed */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Altitude (m) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.altitude}
                    onChange={(e) => handleInputChange('altitude', e.target.value)}
                    placeholder="240.5"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.altitude
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.altitude && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.altitude}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Speed (m/s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.speed}
                    onChange={(e) => handleInputChange('speed', e.target.value)}
                    placeholder="28.0"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.speed
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.speed && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.speed}</p>
                  )}
                </div>
              </div>

              {/* Row 4: Heading & Battery */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Heading (deg, 0-360) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.heading}
                    onChange={(e) => handleInputChange('heading', e.target.value)}
                    placeholder="145.0"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.heading
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.heading && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.heading}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Battery (%) <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.battery}
                    onChange={(e) => handleInputChange('battery', e.target.value)}
                    placeholder="98"
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.battery
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.battery && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.battery}</p>
                  )}
                </div>
              </div>

              {/* Row 5: Flight Mode & Timestamp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Flight Mode
                  </label>
                  <select
                    value={formData.flightMode}
                    onChange={(e) => handleInputChange('flightMode', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-white"
                  >
                    <option value="AUTONOMOUS_NAV">AUTONOMOUS_NAV</option>
                    <option value="WAYPOINT_PATROL">WAYPOINT_PATROL</option>
                    <option value="MANUAL_COMMAND">MANUAL_COMMAND</option>
                    <option value="HOVER_SURVEILLANCE">HOVER_SURVEILLANCE</option>
                    <option value="RETURN_TO_BASE">RETURN_TO_BASE</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Timestamp (Epoch) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSetCurrentTime}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center space-x-1 cursor-pointer"
                      title="Set to current local system time"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Current Time</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={formData.timestamp}
                    onChange={(e) => handleInputChange('timestamp', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-xs font-mono font-medium focus:outline-none focus:ring-2 ${
                      errors.timestamp
                        ? 'border-rose-300 focus:ring-rose-200 bg-rose-50/20'
                        : 'border-slate-300 focus:ring-indigo-200 focus:border-indigo-500'
                    }`}
                  />
                  {errors.timestamp && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.timestamp}</p>
                  )}
                </div>
              </div>

              {/* Security Notification Notice */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start space-x-2 text-[11px] text-slate-600">
                <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  Telemetry will be encrypted with active AES-256-GCM session key and signed with ECDSA NIST P-256 before entering the 10-stage security pipeline.
                </span>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reset Form
                </button>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>PROCESSING...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>SEND TELEMETRY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
