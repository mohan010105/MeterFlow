import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0a0a0a] group-[.toaster]:text-white group-[.toaster]:border-[#2a2a2a] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-[#a0a0a0]",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-[#1a1a1a] group-[.toast]:text-[#a0a0a0] group-[.toast]:border-[#2a2a2a]",
          success:
            "group-[.toaster]:bg-[#0a0a0a] group-[.toaster]:text-white group-[.toaster]:border-[#2a2a2a]",
          error:
            "group-[.toaster]:bg-[#0a0a0a] group-[.toaster]:text-white group-[.toaster]:border-[#2a2a2a]",
          warning:
            "group-[.toaster]:bg-[#0a0a0a] group-[.toaster]:text-white group-[.toaster]:border-[#2a2a2a]",
          info: "group-[.toaster]:bg-[#0a0a0a] group-[.toaster]:text-white group-[.toaster]:border-[#2a2a2a]",
        },
      }}
      style={
        {
          "--normal-bg": "#0a0a0a",
          "--normal-text": "#ffffff",
          "--normal-border": "#2a2a2a",
          "--success-bg": "#0a0a0a",
          "--success-text": "#ffffff",
          "--success-border": "#2a2a2a",
          "--error-bg": "#0a0a0a",
          "--error-text": "#ffffff",
          "--error-border": "#2a2a2a",
          "--warning-bg": "#0a0a0a",
          "--warning-text": "#ffffff",
          "--warning-border": "#2a2a2a",
          "--info-bg": "#0a0a0a",
          "--info-text": "#ffffff",
          "--info-border": "#2a2a2a",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
