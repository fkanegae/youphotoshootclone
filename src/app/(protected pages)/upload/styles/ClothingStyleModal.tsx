import Image from "next/image";

interface ClothingStyle {
  clothingTitle: string;
  clothingPrompt: string;
  image: string;
  gender: string[];
}

interface ClothingStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (style: ClothingStyle) => void;
  clothingStyles: ClothingStyle[];
}

export default function ClothingStyleModal({ isOpen, onClose, onSelect, clothingStyles }: ClothingStyleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-mainBlack">
            Select your clothing style
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {clothingStyles.map((style, index) => (
            <div
              key={index}
              className="group bg-gray-100 rounded-lg shadow-md overflow-hidden transition-shadow hover:shadow-lg cursor-pointer relative flex flex-col h-64"
            >
              <div className="relative h-40" onClick={() => onSelect(style)}>
                <Image
                  src={`${style.image}`}
                  alt={`${style.clothingTitle} style placeholder`}
                  fill
                  className="object-cover transition-opacity group-hover:opacity-90"
                />
              </div>
              <div className="flex flex-col justify-between flex-grow p-3">
                <p className="text-mainBlack font-semibold text-sm line-clamp-2 mb-2">{style.clothingTitle}</p>
                <button
                  className="w-full text-center bg-gray-200 text-gray-700 font-medium py-1.5 rounded text-sm hover:bg-gray-300 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(style);
                  }}
                >
                  Select
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
