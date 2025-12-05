import React from "react";

interface Props {
  src: string | null;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<Props> = ({ src, onClose }) => {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full px-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt="preview"
          className="w-full max-h-[90vh] object-contain rounded-lg shadow-lg select-none"
        />

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white text-2xl bg-black bg-opacity-40 rounded-full px-3 py-1"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
