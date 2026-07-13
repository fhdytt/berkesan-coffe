(function() {
        // Element modal
        const modalElement = document.getElementById('universalModal');
        const closeModalBtn = document.getElementById('closeModalUniversal');
        const openOrderNav = document.getElementById('openOrderFromNav');
        const connectBtn = document.getElementById('connectBtn');
        const scrollToSig = document.getElementById('scrollToSignature');
        const signaturePreviewDiv = document.getElementById('signaturePreview');

        // fungsi buka modal
        function openModal() {
            if(modalElement) {
                modalElement.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        }

        function closeModalFunction() {
            if(modalElement) {
                modalElement.style.display = 'none';
                document.body.style.overflow = '';
            }
        }

        // tombol order dari nav & tombol connect (menampilkan informasi pesan dan kehangatan)
        if(openOrderNav) {
            openOrderNav.addEventListener('click', (e) => {
                e.preventDefault();
                openModal();
            });
        }
        if(connectBtn) {
            connectBtn.addEventListener('click', () => {
                openModal();
            });
        }
        if(closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModalFunction);
        }
        // klik di luar modal menutup
        window.addEventListener('click', (e) => {
            if(e.target === modalElement) {
                closeModalFunction();
            }
        });

        // Smooth scroll ke bagian Signature preview
        if(scrollToSig) {
            scrollToSig.addEventListener('click', (e) => {
                e.preventDefault();
                signaturePreviewDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // efek highlight sementara
                signaturePreviewDiv.style.transition = '0.3s';
                signaturePreviewDiv.style.backgroundColor = '#FFF2E8';
                setTimeout(() => {
                    signaturePreviewDiv.style.backgroundColor = '';
                }, 700);
            });
        }

        // tambahan interaksi: jika pengguna klik pada salah satu signature badge, tampilkan pesan unik
        const allBadges = document.querySelectorAll('.sig-badge');
        allBadges.forEach(badge => {
            badge.addEventListener('click', function() {
                const name = this.innerText.trim();
                let customMessage = '';
                if(name.includes('Seasonal')) customMessage = '🍂 Seasonal Item: nikmati edisi terbatas yang hanya datang pada musimnya, rasa yang tidak akan terlupakan.';
                else if(name.includes('Walktu')) customMessage = '⏳ Walktu: sajian yang mengajakmu menikmati waktu, setiap tegukan terasa lambat dan bermakna.';
                else if(name.includes('Jumpa')) customMessage = '🤝 Jumpa: perjumpaan hangat dalam cangkir, untuk obrolan panjang dan tawa tulus.';
                else if(name.includes('Dia')) customMessage = '🌙 Dia: rasa yang selalu dirindukan, kenangan dalam setiap aroma.';
                else customMessage = 'Nikmati keistimewaan dari setiap signature Berkesan Coffee.';
                
                const toast = document.createElement('div');
                toast.innerText = `✨ ${customMessage}`;
                toast.style.position = 'fixed';
                toast.style.bottom = '30px';
                toast.style.left = '50%';
                toast.style.transform = 'translateX(-50%)';
                toast.style.backgroundColor = '#37251B';
                toast.style.color = '#FDEBDC';
                toast.style.padding = '12px 24px';
                toast.style.borderRadius = '60px';
                toast.style.fontSize = '0.85rem';
                toast.style.zIndex = '1100';
                toast.style.fontWeight = '500';
                toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
                toast.style.backdropFilter = 'blur(8px)';
                toast.style.fontFamily = "'Inter', sans-serif";
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 400);
                }, 2800);
            });
        });

        // additional : jika hover pada logo, ada pesan kecil yang ramah
        const logoEl = document.querySelector('.logo h2');
        if(logoEl) {
            logoEl.addEventListener('click', () => {
                const thanksMsg = document.createElement('div');
                thanksMsg.innerText = '☕ Terima kasih telah singgah di ruang kami. Setiap cerita berarti.';
                thanksMsg.style.position = 'fixed';
                thanksMsg.style.bottom = '20px';
                thanksMsg.style.left = '20px';
                thanksMsg.style.backgroundColor = '#FFF1E6';
                thanksMsg.style.color = '#4F2F1C';
                thanksMsg.style.padding = '10px 20px';
                thanksMsg.style.borderRadius = '40px';
                thanksMsg.style.fontSize = '0.8rem';
                thanksMsg.style.boxShadow = '0 5px 14px rgba(0,0,0,0.1)';
                thanksMsg.style.zIndex = '1099';
                thanksMsg.style.borderLeft = '5px solid #C88C62';
                document.body.appendChild(thanksMsg);
                setTimeout(() => {
                    thanksMsg.style.opacity = '0';
                    setTimeout(() => thanksMsg.remove(), 500);
                }, 2500);
            });
        }
    })();