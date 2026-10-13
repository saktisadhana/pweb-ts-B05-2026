"use strict";
(() => {
    const KUNCI_SESI = "sesi";
    const KUNCI_TIKET = "tiketAntrian";
    const URUTAN_PRIORITAS = ["Disabilitas", "Lansia", "VIP", "Normal"];
    function bacaJson(kunci, cadangan) {
        const nilai = localStorage.getItem(kunci);
        if (nilai === null)
            return cadangan;
        try {
            return JSON.parse(nilai);
        }
        catch {
            return cadangan;
        }
    }
    function ambilSesi() {
        const sesi = bacaJson(KUNCI_SESI, null);
        if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string")
            return null;
        return { token: sesi.token, role: sesi.role.toLowerCase(), nama: sesi.nama ?? "-" };
    }
    const sesi = ambilSesi();
    if (!sesi) {
        location.replace("login.html");
        return;
    }
    if (sesi.role !== "admin" && sesi.role !== "moderator") {
        location.replace("ambil-antrian.html");
        return;
    }
    function bacaTiket() {
        const tiket = bacaJson(KUNCI_TIKET, []);
        return Array.isArray(tiket) ? tiket : [];
    }
    function simpanTiket(tiket) {
        localStorage.setItem(KUNCI_TIKET, JSON.stringify(tiket));
    }
    function tiketBerikutnya(tiket, kode) {
        return tiket
            .filter((item) => item.kode === kode && item.status === "menunggu")
            .sort((a, b) => {
            const prioritasA = URUTAN_PRIORITAS.indexOf(a.prioritas);
            const prioritasB = URUTAN_PRIORITAS.indexOf(b.prioritas);
            return prioritasA - prioritasB || a.dibuat - b.dibuat;
        })[0];
    }
    function render() {
        const semuaTiket = bacaTiket();
        for (const kartu of document.querySelectorAll(".kartu")) {
            const kode = kartu.querySelector("[data-kode]")?.dataset.kode;
            if (!kode)
                continue;
            const menunggu = semuaTiket.filter((tiket) => tiket.kode === kode && tiket.status === "menunggu");
            const aktif = semuaTiket.find((tiket) => tiket.kode === kode && tiket.status === "dipanggil");
            const berikutnya = tiketBerikutnya(semuaTiket, kode);
            const keterangan = kartu.querySelector(".kartu-atas .keterangan");
            const angka = kartu.querySelectorAll(".kartu-tengah .angka");
            const tombolSelesai = kartu.querySelector(".tombol-selesai-pojok");
            const kosong = kartu.querySelector(".kartu-kosong");
            if (keterangan)
                keterangan.textContent = `${menunggu.length} Menunggu`;
            if (angka[0])
                angka[0].textContent = aktif?.nomor ?? "-";
            if (angka[1])
                angka[1].textContent = berikutnya?.nomor ?? "-";
            if (tombolSelesai)
                tombolSelesai.disabled = !aktif;
            if (kosong)
                kosong.hidden = menunggu.length > 0;
        }
    }
    for (const link of document.querySelectorAll('a[href="login.html"]')) {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            localStorage.removeItem(KUNCI_SESI);
            location.replace("login.html");
        });
    }
    document.querySelectorAll("[data-kode]").forEach((tombol) => {
        tombol.addEventListener("click", () => {
            const kode = tombol.dataset.kode;
            if (!kode)
                return;
            const semuaTiket = bacaTiket();
            const aktif = semuaTiket.find((tiket) => tiket.kode === kode && tiket.status === "dipanggil");
            if (tombol.classList.contains("tombol-selesai-pojok")) {
                if (!aktif)
                    return;
                aktif.status = "selesai";
            }
            else {
                const berikutnya = tiketBerikutnya(semuaTiket, kode);
                if (!berikutnya)
                    return;
                berikutnya.status = "dipanggil";
            }
            simpanTiket(semuaTiket);
            render();
        });
    });
    window.addEventListener("storage", (event) => {
        if (event.key === KUNCI_SESI && !ambilSesi()) {
            location.replace("login.html");
        }
        else if (event.key === KUNCI_TIKET) {
            render();
        }
    });
    render();
})();
