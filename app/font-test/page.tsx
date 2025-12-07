export default function FontTest() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-mona-heading">Mona Sans Font Test</h1>

      <div className="space-y-4">
        <h2 className="text-2xl font-mona-bold">Weight Variations</h2>
        <div className="space-y-2">
          <p className="font-mona-extralight">Extra Light (200) - Quick brown fox</p>
          <p className="font-mona-light">Light (300) - Quick brown fox</p>
          <p className="font-mona-regular">Regular (400) - Quick brown fox</p>
          <p className="font-mona-medium">Medium (500) - Quick brown fox</p>
          <p className="font-mona-semibold">Semibold (600) - Quick brown fox</p>
          <p className="font-mona-bold">Bold (700) - Quick brown fox</p>
          <p className="font-mona-extrabold">Extra Bold (800) - Quick brown fox</p>
          <p className="font-mona-black">Black (900) - Quick brown fox</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-mona-bold">Width Variations</h2>
        <div className="space-y-2">
          <p className="font-mona-narrow">Narrow - Quick brown fox jumps</p>
          <p className="font-mona-regular">Regular - Quick brown fox jumps</p>
          <p className="font-mona-wide">Wide - Quick brown fox jumps</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-mona-bold">Special Use Cases</h2>
        <div className="space-y-2">
          <h1 className="text-4xl font-mona-display">Display Heading</h1>
          <h2 className="text-2xl font-mona-heading">Section Heading</h2>
          <h3 className="text-xl font-mona-subheading">Subheading</h3>
          <p className="text-sm font-mona-caption">Caption text for images and small content</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-mona-bold">Tailwind Font Weights</h2>
        <div className="space-y-2">
          <p className="font-thin">Tailwind Thin</p>
          <p className="font-light">Tailwind Light</p>
          <p className="font-normal">Tailwind Normal</p>
          <p className="font-medium">Tailwind Medium</p>
          <p className="font-semibold">Tailwind Semibold</p>
          <p className="font-bold">Tailwind Bold</p>
          <p className="font-extrabold">Tailwind Extra Bold</p>
          <p className="font-black">Tailwind Black</p>
        </div>
      </div>
    </div>
  );
}