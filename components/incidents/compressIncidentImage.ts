export function compressIncidentImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Choisissez un fichier image."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire cette image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Le fichier sélectionné n'est pas une image valide."));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 800 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("La compression de l'image n'est pas disponible."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 1_000_000 && quality > 0.2) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > 1_000_000) {
          reject(new Error("L'image est trop volumineuse après compression."));
          return;
        }
        resolve(dataUrl);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
