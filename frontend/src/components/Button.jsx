import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-[#4F46E5] text-white shadow-[0_10px_24px_rgba(79,70,229,0.18)] hover:bg-[#4338CA] hover:shadow-[0_12px_28px_rgba(79,70,229,0.24)]",
  secondary: "glass-button",
  danger: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
  ghost: "text-[#475569] hover:bg-[#EEF2FF] hover:text-[#3730A3]",
};

export default function Button({ children, icon: Icon, loading, variant = "primary", className = "", ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </button>
  );
}
