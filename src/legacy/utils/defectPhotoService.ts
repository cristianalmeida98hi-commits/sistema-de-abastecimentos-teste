import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, ensureFirebaseAuth, firebaseDisabled } from '../lib/firebase';

export interface ProcessedPhoto {
  id: string;
  file?: File;
  blob: Blob;
  previewUrl: string;
  sizeBytes: number;
  fileName: string;
}

export interface UploadedPhotoResult {
  photoUrls: string[];
  photoStoragePaths: string[];
  failedCount: number;
  lastErrorMessage?: string;
  errors?: string[];
}

/**
 * Traduz e detalha erros técnicos do Firebase Storage para mensagens claras ao usuário.
 */
export function parseStorageErrorMessage(err: any): string {
  if (!err) return 'Erro desconhecido de comunicação com o servidor de armazenamento.';
  
  const code = err.code || '';
  const message = err.message || '';
  const status = err.status_ || (err.customData && err.customData.status_) || 0;

  // 404: Bucket não provisionado ou não existente no Firebase Console
  if (
    status === 404 || 
    (code === 'storage/unknown' && (message.includes('404') || message.includes('unknown error occurred'))) ||
    message.includes('bucket') && message.includes('not found')
  ) {
    return 'O bucket de armazenamento "andrade-agro.firebasestorage.app" ainda não foi ativado no Console do Firebase (Google Cloud Storage retornou 404 Not Found). É necessário acessar o Firebase Console e clicar em "Começar" no menu Storage.';
  }

  // 403 / unauthorized: Regras de segurança bloqueando
  if (code === 'storage/unauthorized' || message.includes('unauthorized') || message.includes('permission')) {
    return 'Permissão negada pelas regras de segurança do Firebase Storage (storage.rules). Verifique se a sessão do usuário está ativa.';
  }

  if (code === 'storage/quota-exceeded') {
    return 'Cota de armazenamento do Firebase Storage excedida.';
  }

  if (code === 'storage/retry-limit-exceeded' || message.includes('network') || message.includes('Failed to fetch')) {
    return 'Tempo limite de conexão esgotado ou falha de conexão com a internet ao enviar a foto.';
  }

  if (code === 'storage/canceled') {
    return 'O envio da imagem foi cancelado pelo usuário.';
  }

  return message || 'Falha técnica ao tentar salvar imagem no Firebase Storage.';
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Targets ~200 KB to 500 KB while maintaining high visual clarity of the defect.
 * Compatível com fotos de câmeras de celular (Android, iOS/Safari, HEIC/HEIF).
 */
export async function compressDefectImage(file: File): Promise<ProcessedPhoto> {
  return new Promise((resolve, reject) => {
    // Validar se o arquivo é imagem (inclusive formatos de celular como HEIC/HEIF ou arquivos sem MIME no mobile)
    const isImage = (file.type && file.type.startsWith('image/')) || 
                    /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
    
    if (!isImage) {
      return reject(new Error('Apenas arquivos de imagem (JPG, PNG, WEBP, HEIC) são permitidos.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo da foto do dispositivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        // Alerta informativo caso seja HEIC puro não suportado pelo canvas do navegador
        if (/\.(heic|heif)$/i.test(file.name) || file.type.includes('heic') || file.type.includes('heif')) {
          reject(new Error('O formato HEIC desta foto não pôde ser decodificado pelo navegador. No iPhone, tire a foto pela câmera do aplicativo ou ajuste a câmera para "Mais Compatível".'));
        } else {
          reject(new Error('Não foi possível carregar e decodificar a imagem selecionada.'));
        }
      };

      img.onload = () => {
        try {
          const maxDim = 1600; // Nitidez ideal para visualizar detalhes de peças e vazamentos
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Erro ao processar imagem no navegador.'));
          }

          // Fundo branco caso a imagem tenha transparência
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Compressão progressiva visando 200KB - 500KB
          let quality = 0.82;
          
          const attemptCompression = (q: number): Promise<Blob> => {
            return new Promise((resBlob, rejBlob) => {
              canvas.toBlob(
                (blob) => {
                  if (blob) resBlob(blob);
                  else rejBlob(new Error('Falha ao gerar arquivo comprimido da imagem.'));
                },
                'image/jpeg',
                q
              );
            });
          };

          attemptCompression(quality).then(async (blob) => {
            let finalBlob = blob;
            if (finalBlob.size > 550 * 1024) {
              const secondBlob = await attemptCompression(0.70);
              finalBlob = secondBlob;
            }
            if (finalBlob.size > 600 * 1024) {
              const thirdBlob = await attemptCompression(0.58);
              finalBlob = thirdBlob;
            }

            const previewUrl = URL.createObjectURL(finalBlob);
            const photoId = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

            resolve({
              id: photoId,
              file,
              blob: finalBlob,
              previewUrl,
              sizeBytes: finalBlob.size,
              fileName: file.name.replace(/\.[^/.]+$/, "") + '.jpg'
            });
          }).catch(reject);

        } catch (procErr) {
          reject(procErr);
        }
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Envia imagens comprimidas ao Cloudinary usando assinatura temporária gerada no servidor.
 * O segredo da API nunca é enviado ao navegador.
 */
export async function uploadDefectPhotos(
  issueId: string,
  photos: ProcessedPhoto[]
): Promise<UploadedPhotoResult> {
  if (firebaseDisabled) throw new Error('O envio de fotos está desativado no modo de teste.');
  if (!photos || photos.length === 0) {
    return { photoUrls: [], photoStoragePaths: [], failedCount: 0 };
  }

  const user = await ensureFirebaseAuth();
  if (!user) throw new Error('Não foi possível validar a sessão Firebase para enviar as fotos.');

  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      const photoId = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const token = await user.getIdToken();
      const signatureResponse = await fetch('/api/cloudinary/signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ issueId, photoId })
      });
      const signatureData = await signatureResponse.json().catch(() => ({}));
      if (!signatureResponse.ok || !signatureData.ok) {
        throw new Error(signatureData.error || 'Não foi possível preparar o envio seguro da foto.');
      }

      const form = new FormData();
      form.append('file', photo.blob, photo.fileName);
      form.append('api_key', signatureData.apiKey);
      form.append('timestamp', String(signatureData.timestamp));
      form.append('public_id', signatureData.publicId);
      form.append('upload_preset', signatureData.uploadPreset);
      form.append('signature', signatureData.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signatureData.cloudName)}/image/upload`,
        { method: 'POST', body: form }
      );
      const uploadData = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || !uploadData.secure_url || !uploadData.public_id) {
        throw new Error(uploadData.error?.message || 'O Cloudinary recusou o envio da imagem.');
      }

      uploadedPaths.push(uploadData.public_id);
      uploadedUrls.push(uploadData.secure_url);
    } catch (photoErr: any) {
      const message = photoErr?.message || 'Falha ao enviar a foto.';
      console.error(`[AndradeAgro Cloudinary] Falha na foto ${i + 1}/${photos.length}:`, message);
      errors.push(`Foto ${i + 1} (${photo.fileName}): ${message}`);
    }
  }

  if (uploadedUrls.length === 0 && photos.length > 0) {
    const uploadErr: any = new Error(errors[0] || 'Falha ao enviar fotos para o Cloudinary.');
    uploadErr.errors = errors;
    uploadErr.uploadedPaths = uploadedPaths;
    uploadErr.uploadedUrls = uploadedUrls;
    throw uploadErr;
  }

  return {
    photoUrls: uploadedUrls,
    photoStoragePaths: uploadedPaths,
    failedCount: errors.length,
    lastErrorMessage: errors.length > 0 ? errors.join('\n') : undefined,
    errors
  };
}

/**
 * Exclui fotos do Cloudinary e mantém suporte aos caminhos/URLs antigos do Firebase Storage.
 */
export async function deleteDefectPhotos(storagePathsOrUrls: string[]): Promise<void> {
  if (firebaseDisabled || !storagePathsOrUrls || storagePathsOrUrls.length === 0) return;

  const cloudinaryIds = storagePathsOrUrls.filter(item => {
    if (typeof item !== 'string') return false;
    const parts = item.split('/');
    return parts.length === 4 && parts[0] === 'andrade_agro' && parts[1] === 'defeitos' &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(parts[2]) && /^[a-zA-Z0-9_-]{1,120}$/.test(parts[3]);
  });
  const legacyItems = storagePathsOrUrls.filter(item =>
    item && !cloudinaryIds.includes(item) && !item.startsWith('data:') && !item.includes('unsplash.com') && !item.includes('res.cloudinary.com')
  );

  if (cloudinaryIds.length > 0) {
    try {
      const user = await ensureFirebaseAuth();
      if (!user) throw new Error('Sessão Firebase indisponível.');
      const token = await user.getIdToken();
      const response = await fetch('/api/cloudinary/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ publicIds: cloudinaryIds })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const details = Array.isArray(result.results)
          ? result.results.filter((item: any) => !item.ok).map((item: any) => item.error || item.result || item.publicId).join('; ')
          : '';
        throw new Error(details
          ? `O Cloudinary não confirmou a exclusão de todas as fotos: ${details}`
          : (result.error || 'O Cloudinary não confirmou a exclusão das fotos.'));
      }
    } catch (error: any) {
      console.error('[AndradeAgro Cloudinary] Falha ao solicitar exclusão:', error?.message || error);
      throw error instanceof Error ? error : new Error('Falha ao excluir as fotos do Cloudinary.');
    }
  }

  if (legacyItems.length > 0) {
    await ensureFirebaseAuth();
    for (const item of legacyItems) {
      try {
        await deleteObject(ref(storage, item));
      } catch (delErr: any) {
        if (delErr?.code === 'storage/object-not-found' || delErr?.message?.includes('not-found')) {
          console.info(`[AndradeAgro Storage] Foto antiga já não existia: ${item}`);
        } else {
          console.warn(`[AndradeAgro Storage] Aviso ao remover foto antiga ${item}:`, delErr?.message || delErr);
        }
      }
    }
  }
}
