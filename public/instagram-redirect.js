// public/instagram-redirect.js
// Script ini akan dijalankan sebelum React dimuat untuk memastikan redirect instan

(function() {
    // Deteksi apakah di in-app browser Instagram dan apakah di iOS
    function isInstagramIOSBrowser() {
      const userAgent = navigator.userAgent || "";
      return userAgent.includes("Instagram") && 
             (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod"));
    }
  
    // Deteksi apakah ini halaman yang di-reload setelah redirect
    function isRedirectReturn() {
      try {
        return sessionStorage.getItem('instagramRedirectAttempted') === 'true';
      } catch (e) {
        return false;
      }
    }
  
    // Fungsi untuk membuka di Safari di iOS
    function openInSafari(url) {
      // Jika ini adalah reload setelah redirect gagal, jangan redirect lagi
      if (isRedirectReturn()) {
        console.log("Halaman sudah pernah di-redirect, menghindari redirect loop");
        return;
      }
      
      // Set flag di sessionStorage bahwa redirect sudah dicoba
      try {
        sessionStorage.setItem('instagramRedirectAttempted', 'true');
        sessionStorage.setItem('redirectTime', Date.now());
      } catch (e) {
        // Ignore storage errors
      }
      
      // Tambahkan parameter untuk menghindari cache
      const noCacheUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
      
      // Gunakan x-safari-https:// URL scheme untuk iOS
      const safariScheme = `x-safari-https://${noCacheUrl.replace(/^https?:\/\//, '')}`;
      
      // Tambahkan visual feedback
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;';
      div.innerHTML = '<div style="text-align:center;padding:20px;"><div style="font-size:20px;margin-bottom:10px;">Membuka di Safari...</div><div style="opacity:0.7;font-size:14px;">Jika halaman tidak terbuka otomatis, klik "Buka" saat diminta</div></div>';
      document.body.appendChild(div);
      
      // Pada iOS, langsung coba skema Safari
      setTimeout(() => {
        window.location.href = safariScheme;
      }, 500);
      
      // Fallback setelah beberapa saat jika skema utama gagal
      setTimeout(() => {
        // Coba metode alternatif jika yang pertama gagal
        const legacyScheme = `com-apple-mobilesafari-tab:${noCacheUrl}`;
        window.location.href = legacyScheme;
      }, 1500);
    }
  
    // Lakukan redirect instan jika di Instagram iOS browser dan bukan return
    if (isInstagramIOSBrowser() && !isRedirectReturn()) {
      console.log("Instagram iOS browser terdeteksi - mencoba redirect langsung");
      openInSafari(window.location.href);
    } else if (isInstagramIOSBrowser() && isRedirectReturn()) {
      console.log("Redirect sudah dicoba sebelumnya, melanjutkan load app");
      // Tambahkan fallback UI jika kita telah kembali dari percobaan redirect
      window.addEventListener('DOMContentLoaded', function() {
        const root = document.getElementById('root');
        if (root && !root.hasChildNodes()) {
          const fallbackUI = document.createElement('div');
          fallbackUI.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
          fallbackUI.innerHTML = `
            <div style="text-align:center;padding:20px;max-width:400px;">
              <div style="font-size:24px;margin-bottom:20px;">Netramaya AR Camera</div>
              <div style="margin-bottom:20px;opacity:0.8;">Untuk pengalaman AR terbaik, gunakan Safari atau Chrome. In-app browser Instagram memiliki keterbatasan.</div>
              <button id="retry-safari" style="background:#0095f6;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;margin-bottom:12px;width:100%;">Buka di Safari</button>
              <button id="continue-instagram" style="background:rgba(255,255,255,0.2);color:#fff;border:none;padding:12px 24px;border-radius:8px;width:100%;">Lanjutkan di Instagram</button>
            </div>
          `;
          
          document.body.appendChild(fallbackUI);
          
          document.getElementById('retry-safari').addEventListener('click', function() {
            // Reset flag dan coba lagi
            try {
              sessionStorage.removeItem('instagramRedirectAttempted');
            } catch (e) {}
            openInSafari(window.location.href);
          });
          
          document.getElementById('continue-instagram').addEventListener('click', function() {
            document.body.removeChild(fallbackUI);
          });
        }
      });
    }
  })();