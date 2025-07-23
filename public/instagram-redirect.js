// public/instagram-redirect.js
// Script ini akan dijalankan sebelum React dimuat untuk memastikan redirect instan

(function() {
    // Deteksi apakah di in-app browser Instagram dan apakah di iOS
    function isInstagramIOSBrowser() {
      const userAgent = navigator.userAgent || "";
      return userAgent.includes("Instagram") && 
             (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod"));
    }
  
    // Fungsi untuk membuka di Safari di iOS
    function openInSafari(url) {
      // Gunakan x-safari-https:// URL scheme untuk iOS
      const safariScheme = `x-safari-https://${url.replace(/^https?:\/\//, '')}`;
      
      // Pada iOS, langsung coba skema Safari
      window.location.href = safariScheme;
      
      // Fallback setelah beberapa saat jika skema utama gagal
      setTimeout(() => {
        // Coba metode alternatif jika yang pertama gagal
        const legacyScheme = `com-apple-mobilesafari-tab:${url}`;
        window.location.href = legacyScheme;
      }, 500);
    }
  
    // Lakukan redirect instan jika di Instagram iOS browser
    if (isInstagramIOSBrowser()) {
      console.log("Instagram iOS browser terdeteksi - mencoba redirect langsung");
      openInSafari(window.location.href);
      
      // Set flag di sessionStorage bahwa redirect sudah dicoba
      try {
        sessionStorage.setItem('instagramRedirectAttempted', 'true');
      } catch (e) {
        // Ignore storage errors
      }
    }
  })();