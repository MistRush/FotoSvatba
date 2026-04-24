/* ============================================
   SVATBA FOTO – App Logic
   Upload, compression, gallery, lightbox
   ============================================ */

(function () {
    'use strict';

    // ---------- Config ----------
    const CONFIG = {
        maxFileSizeMB: 2,
        maxWidthOrHeight: 2048,
        compressionQuality: 0.8,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
        maxFiles: 30,
    };

    // ---------- DOM Elements ----------
    const els = {
        scrollIndicator: document.getElementById('scrollIndicator'),
        uploadArea: document.getElementById('uploadArea'),
        fileInput: document.getElementById('fileInput'),
        uploadBtn: document.getElementById('uploadBtn'),
        guestName: document.getElementById('guestName'),
        uploadPreview: document.getElementById('uploadPreview'),
        previewGrid: document.getElementById('previewGrid'),
        clearBtn: document.getElementById('clearBtn'),
        fileCount: document.getElementById('fileCount'),
        submitBtn: document.getElementById('submitBtn'),
        progressSection: document.getElementById('progressSection'),
        progressLabel: document.getElementById('progressLabel'),
        progressCount: document.getElementById('progressCount'),
        progressFill: document.getElementById('progressFill'),
        progressStatus: document.getElementById('progressStatus'),
        successMessage: document.getElementById('successMessage'),
        uploadMoreBtn: document.getElementById('uploadMoreBtn'),
        galleryGrid: document.getElementById('galleryGrid'),
        galleryLoading: document.getElementById('galleryLoading'),
        galleryEmpty: document.getElementById('galleryEmpty'),
        refreshBtn: document.getElementById('refreshBtn'),
        lightbox: document.getElementById('lightbox'),
        lightboxImg: document.getElementById('lightboxImg'),
        lightboxCaption: document.getElementById('lightboxCaption'),
        lightboxClose: document.getElementById('lightboxClose'),
        lightboxPrev: document.getElementById('lightboxPrev'),
        lightboxNext: document.getElementById('lightboxNext'),
    };

    // ---------- State ----------
    let selectedFiles = [];
    let galleryImages = [];
    let currentLightboxIndex = -1;

    // ---------- Init ----------
    function init() {
        bindEvents();
        loadGallery();
        restoreGuestName();
    }

    // ---------- Event Binding ----------
    function bindEvents() {
        // Scroll indicator click
        els.scrollIndicator.addEventListener('click', () => {
            document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
        });

        // Upload area click
        els.uploadArea.addEventListener('click', (e) => {
            if (e.target !== els.uploadBtn && !els.uploadBtn.contains(e.target)) {
                els.fileInput.click();
            }
        });

        els.uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            els.fileInput.click();
        });

        // File selection
        els.fileInput.addEventListener('change', handleFileSelect);

        // Drag & drop
        els.uploadArea.addEventListener('dragover', handleDragOver);
        els.uploadArea.addEventListener('dragleave', handleDragLeave);
        els.uploadArea.addEventListener('drop', handleDrop);

        // Clear files
        els.clearBtn.addEventListener('click', clearFiles);

        // Submit upload
        els.submitBtn.addEventListener('click', handleUpload);

        // Upload more
        els.uploadMoreBtn.addEventListener('click', resetUpload);

        // Refresh gallery
        els.refreshBtn.addEventListener('click', loadGallery);

        // Lightbox
        els.lightboxClose.addEventListener('click', closeLightbox);
        els.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
        els.lightboxNext.addEventListener('click', () => navigateLightbox(1));
        els.lightbox.addEventListener('click', (e) => {
            if (e.target === els.lightbox || e.target.classList.contains('lightbox-content')) {
                closeLightbox();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!els.lightbox.hidden) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') navigateLightbox(-1);
                if (e.key === 'ArrowRight') navigateLightbox(1);
            }
        });

        // Save guest name
        els.guestName.addEventListener('input', () => {
            localStorage.setItem('svatba_guest_name', els.guestName.value);
        });
    }

    // ---------- Guest Name ----------
    function restoreGuestName() {
        const saved = localStorage.getItem('svatba_guest_name');
        if (saved) {
            els.guestName.value = saved;
        }
    }

    // ---------- File Selection ----------
    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        addFiles(files);
        // Reset input so same files can be reselected
        els.fileInput.value = '';
    }

    function handleDragOver(e) {
        e.preventDefault();
        els.uploadArea.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        els.uploadArea.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        els.uploadArea.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addFiles(files);
    }

    function addFiles(files) {
        const validFiles = files.filter(f => {
            if (!f.type.startsWith('image/')) {
                return false;
            }
            return true;
        });

        if (selectedFiles.length + validFiles.length > CONFIG.maxFiles) {
            alert(`Můžete nahrát maximálně ${CONFIG.maxFiles} fotek najednou.`);
            return;
        }

        selectedFiles = [...selectedFiles, ...validFiles];
        renderPreviews();
    }

    function renderPreviews() {
        if (selectedFiles.length === 0) {
            els.uploadPreview.hidden = true;
            return;
        }

        els.uploadPreview.hidden = false;
        els.previewGrid.innerHTML = '';
        els.fileCount.textContent = selectedFiles.length;

        selectedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            item.style.animationDelay = `${index * 0.05}s`;

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            img.onload = () => URL.revokeObjectURL(img.src);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFiles.splice(index, 1);
                renderPreviews();
            });

            item.appendChild(img);
            item.appendChild(removeBtn);
            els.previewGrid.appendChild(item);
        });
    }

    function clearFiles() {
        selectedFiles = [];
        renderPreviews();
    }

    // ---------- Upload ----------
    async function handleUpload() {
        if (selectedFiles.length === 0) return;

        const guestName = els.guestName.value.trim() || 'Anonym';

        // Show progress
        els.uploadPreview.hidden = true;
        els.progressSection.hidden = false;
        els.submitBtn.disabled = true;

        const total = selectedFiles.length;
        let uploaded = 0;
        let failed = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            try {
                // Update status
                els.progressStatus.textContent = `Komprese: ${file.name}...`;
                els.progressLabel.textContent = `Nahrávám fotku ${i + 1} z ${total}...`;

                // Compress
                const compressed = await compressImage(file);

                // Upload
                els.progressStatus.textContent = `Odesílám: ${file.name}...`;
                await uploadFile(compressed, guestName);

                uploaded++;
            } catch (err) {
                console.error('Upload failed:', file.name, err);
                failed++;
            }

            // Update progress bar
            const progress = ((i + 1) / total) * 100;
            els.progressFill.style.width = `${progress}%`;
            els.progressCount.textContent = `${i + 1}/${total}`;
        }

        // Show result
        els.progressSection.hidden = true;

        if (failed === 0) {
            els.successMessage.hidden = false;
        } else if (uploaded > 0) {
            els.successMessage.hidden = false;
            els.successMessage.querySelector('.success-text').textContent =
                `Nahráno ${uploaded} z ${total} fotek. ${failed} se nepodařilo nahrát.`;
        } else {
            alert('Nahrávání se nezdařilo. Zkontrolujte připojení k internetu a zkuste to znovu.');
            resetUpload();
        }

        // Refresh gallery
        setTimeout(loadGallery, 1000);
    }

    async function compressImage(file) {
        // Skip compression for small files
        if (file.size < 500 * 1024) {
            return file;
        }

        const options = {
            maxSizeMB: CONFIG.maxFileSizeMB,
            maxWidthOrHeight: CONFIG.maxWidthOrHeight,
            useWebWorker: true,
            fileType: 'image/jpeg',
            initialQuality: CONFIG.compressionQuality,
        };

        try {
            return await imageCompression(file, options);
        } catch (err) {
            console.warn('Compression failed, using original:', err);
            return file;
        }
    }

    async function uploadFile(file, guestName) {
        // Convert file to base64
        const base64 = await fileToBase64(file);

        const response = await fetch('/.netlify/functions/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64,
                fileName: file.name,
                mimeType: file.type || 'image/jpeg',
                guestName: guestName,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload failed with status ${response.status}`);
        }

        return response.json();
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function resetUpload() {
        selectedFiles = [];
        els.uploadPreview.hidden = true;
        els.progressSection.hidden = true;
        els.successMessage.hidden = true;
        els.submitBtn.disabled = false;
        els.progressFill.style.width = '0%';
        els.previewGrid.innerHTML = '';
    }

    // ---------- Gallery ----------
    async function loadGallery() {
        els.galleryLoading.hidden = false;
        els.galleryEmpty.hidden = true;

        try {
            const response = await fetch('/.netlify/functions/gallery');
            if (!response.ok) throw new Error('Failed to load gallery');

            const data = await response.json();
            galleryImages = data.files || [];

            renderGallery();
        } catch (err) {
            console.error('Gallery load error:', err);
            els.galleryLoading.hidden = true;
            // Show empty state on error (might be first load with no files)
            els.galleryEmpty.hidden = false;
        }
    }

    function renderGallery() {
        els.galleryLoading.hidden = true;
        els.galleryGrid.innerHTML = '';

        if (galleryImages.length === 0) {
            els.galleryEmpty.hidden = false;
            return;
        }

        els.galleryEmpty.hidden = true;

        galleryImages.forEach((image, index) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.style.animationDelay = `${index * 0.05}s`;

            const img = document.createElement('img');
            img.src = `/.netlify/functions/thumbnail?id=${image.id}`;
            img.alt = image.name || 'Svatební fotka';
            img.loading = 'lazy';

            // Error fallback
            img.onerror = () => {
                img.src = 'data:image/svg+xml,' + encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
                    '<rect fill="#1a1a2e" width="200" height="200"/>' +
                    '<text x="100" y="100" text-anchor="middle" fill="#c9a96e" font-size="48">📷</text>' +
                    '</svg>'
                );
            };

            item.appendChild(img);

            // Guest name overlay
            if (image.guestName) {
                const overlay = document.createElement('div');
                overlay.className = 'gallery-item-overlay';
                const nameEl = document.createElement('span');
                nameEl.className = 'gallery-item-name';
                nameEl.textContent = image.guestName;
                overlay.appendChild(nameEl);
                item.appendChild(overlay);
            }

            item.addEventListener('click', () => openLightbox(index));
            els.galleryGrid.appendChild(item);
        });
    }

    // ---------- Lightbox ----------
    function openLightbox(index) {
        currentLightboxIndex = index;
        const image = galleryImages[index];

        els.lightboxImg.src = `/.netlify/functions/thumbnail?id=${image.id}&full=1`;
        els.lightboxCaption.textContent = image.guestName
            ? `📸 ${image.guestName}`
            : '';
        els.lightbox.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        els.lightbox.hidden = true;
        document.body.style.overflow = '';
        els.lightboxImg.src = '';
    }

    function navigateLightbox(direction) {
        const newIndex = currentLightboxIndex + direction;
        if (newIndex >= 0 && newIndex < galleryImages.length) {
            openLightbox(newIndex);
        }
    }

    // ---------- Start ----------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
