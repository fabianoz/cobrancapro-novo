import Image from 'next/image';

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <Image
            src="/Imagem_do_WhatsApp_de_2025-10-08_a(s)_09.49.59_11e81467.jpg"
            alt="ZM Sistemas"
            width={32}
            height={32}
            className="rounded-lg object-cover"
          />
          <span className="font-semibold text-sm">ZM Sistemas</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Desenvolvido por ZM Sistemas · CobrancaPro
        </p>
      </div>
    </footer>
  );
}
