import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--accent)] text-white hover:bg-[color-mix(in_oklab,var(--accent),white_10%)] shadow-lg shadow-purple-500/20",
        secondary:
          "bg-[var(--card)] text-foreground border border-[var(--border)] hover:bg-[color-mix(in_oklab,var(--card),white_6%)]",
        ghost: "hover:bg-[var(--card)] text-foreground",
        outline:
          "border border-[var(--border)] bg-transparent hover:bg-[var(--card)]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";
