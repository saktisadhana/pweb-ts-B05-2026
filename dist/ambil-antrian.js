"use strict";
// dibungkus fungsi biar type dan const di sini gak bentrok sama file .ts lain
// (file ts di proyek ini bukan module, jadi waktu dikompilasi semuanya satu scope global)
(() => {
    // key dan bentuk datanya sama persis dengan index.ts
    const KUNCI_SESI = "sesi";
    const KUNCI_JENIS = "jenisAntrian";
    const KUNCI_TIKET = "tiketAntrian";
    // urutan chip sama dengan di ambil-antrian.html
    const PILIHAN_PRIORITAS = ["Lansia", "Disabilitas", "VIP", "Normal"];
    // soal minta polling 2-3 detik
    const JEDA_POLLING = 2500;
    // dipakai kalau dashboard belum pernah dibuka (sama dengan JENIS_AWAL di index.ts)
    const JENIS_AWAL = [
        { kode: "A", nama: "UMUM-1", aktif: true },
        { kode: "B", nama: "UMUM-2", aktif: true },
        { kode: "C", nama: "UMUM-3", aktif: true },
        { kode: "G", nama: "GIGI", aktif: true },
        { kode: "F", nama: "FARMASI", aktif: true },
        { kode: "P", nama: "PSIKOLOG", aktif: true },
    ];
    function bacaJson(kunci, cadangan) {
        const mentah = localStorage.getItem(kunci);
        if (mentah === null)
            return cadangan;
        try {
            return JSON.parse(mentah);
        }
        catch {
            return cadangan;
        }
    }
    function ambilSesi() {
        const sesi = bacaJson(KUNCI_SESI, null);
        if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string")
            return null;
        return { token: sesi.token, role: sesi.role, nama: sesi.nama ?? "-" };
    }
    // auth guard: halaman ini cuma buat yang sudah login (user, admin, moderator semuanya boleh)
    if (ambilSesi() === null) {
        location.replace("login.html");
        return;
    }
    function bacaJenis() {
        const jenis = bacaJson(KUNCI_JENIS, JENIS_AWAL);
        return Array.isArray(jenis) ? jenis : [];
    }
    function bacaTiket() {
        const tiket = bacaJson(KUNCI_TIKET, []);
        return Array.isArray(tiket) ? tiket : [];
    }
    function ambil(selector) {
        const el = document.querySelector(selector);
        if (!el)
            throw new Error(`Elemen ${selector} tidak ketemu`);
        return el;
    }
    function buat(tag, kelas = "", teks = "") {
        const el = document.createElement(tag);
        if (kelas)
            el.className = kelas;
        if (teks)
            el.textContent = teks;
        return el;
    }
    const wadahKartu = ambil(".panel-utama");
    // pakai gaya .notif yang sudah ada di style.css
    const notif = buat("p", "notif");
    notif.setAttribute("role", "status");
    notif.setAttribute("aria-live", "polite");
    document.body.append(notif);
    let timerNotif;
    function tampilkanNotif(pesan, gagal = false) {
        notif.textContent = pesan;
        notif.classList.toggle("gagal", gagal);
        notif.classList.add("muncul");
        clearTimeout(timerNotif);
        timerNotif = window.setTimeout(() => notif.classList.remove("muncul"), 3000);
    }
    // Exit = keluar akun, jadi sesinya dihapus dulu (sama seperti logout di dashboard)
    for (const link of document.querySelectorAll('a[href="login.html"]')) {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem(KUNCI_SESI);
            location.replace("login.html");
        });
    }
    // ---------- layar penuh ----------
    const navMenu = ambil(".panel-nav");
    // admin/moderator juga boleh buka halaman ini, jadi dikasih jalan balik ke dashboard
    if (["admin", "moderator"].includes(ambilSesi()?.role.toLowerCase() ?? "")) {
        const linkDashboard = buat("a", "tombol", "Dashboard");
        linkDashboard.href = "index.html";
        navMenu.prepend(linkDashboard);
    }
    const tombolPenuh = buat("button", "tombol");
    tombolPenuh.type = "button";
    navMenu.insertBefore(tombolPenuh, navMenu.lastElementChild); // sebelum tombol Exit
    function aturLabelPenuh() {
        tombolPenuh.textContent = document.fullscreenElement ? "Keluar Layar Penuh" : "Layar Penuh";
    }
    tombolPenuh.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
            else {
                await document.documentElement.requestFullscreen();
            }
        }
        catch {
            tampilkanNotif("Browser tidak mengizinkan layar penuh.", true);
        }
    });
    // label ikut berubah juga kalau keluar lewat tombol Esc
    document.addEventListener("fullscreenchange", aturLabelPenuh);
    aturLabelPenuh();
    // ---------- dialog nomor tiket ----------
    // pakai gaya .dialog yang sudah ada di style.css, isinya diisi pas tiket berhasil dibuat
    const dialog = buat("dialog", "panel dialog");
    // gaya nomornya di style.css (.dialog-nomor), pakai font judul Tourney biar sama kayak desain
    const dialogNomor = buat("p", "judul dialog-nomor");
    const dialogInfo = buat("p");
    const dialogTutup = buat("button", "tombol", "Tutup");
    const dialogTombol = buat("div", "dialog-tombol");
    dialogTombol.append(dialogTutup);
    const dialogForm = buat("form");
    dialogForm.method = "dialog";
    dialogForm.append(buat("p", "", "Nomor antrian kamu:"), dialogNomor, dialogInfo, dialogTombol);
    dialog.append(dialogForm);
    document.body.append(dialog);
    function tampilkanTiket(tiket, namaJenis) {
        dialogNomor.textContent = tiket.nomor;
        dialogInfo.textContent = `${namaJenis}, prioritas ${tiket.prioritas}. Tunggu sampai nomor ini muncul di Layar Antrian.`;
        dialog.showModal();
    }
    // ---------- kartu jenis antrian ----------
    const totalTiket = new Map();
    let tandaJenis = "";
    function cekPrioritas(nilai) {
        return PILIHAN_PRIORITAS.find((p) => p === nilai) ?? "Normal";
    }
    // struktur dan class-nya sama dengan kartu di ambil-antrian.html
    function buatKartu(jenis, terpilih) {
        const kartu = buat("article", "kartu");
        kartu.dataset.kode = jenis.kode;
        const nama = buat("h2", "nama-antrian");
        nama.append(buat("b", "", jenis.nama), buat("i", "", `(${jenis.kode})`));
        const blokNama = buat("div", "blok-info");
        blokNama.append(nama, buat("p", "keterangan", "Ambil dengan prioritas:"));
        const total = buat("p", "angka");
        const blokTotal = buat("div", "blok-info rata-kanan");
        blokTotal.append(total, buat("p", "keterangan", "Total tiket hari ini"));
        const atas = buat("div", "kartu-atas");
        atas.append(blokNama, blokTotal);
        const pilihan = buat("fieldset", "pilihan-prioritas kartu-bawah kartu-chip");
        pilihan.append(buat("legend", "sr-only", `Prioritas ${jenis.nama}`));
        for (const prioritas of PILIHAN_PRIORITAS) {
            const input = buat("input");
            input.type = "radio";
            input.name = `prioritas-${jenis.kode.toLowerCase()}`;
            input.value = prioritas;
            input.checked = prioritas === terpilih;
            const chip = buat("label", "chip");
            chip.append(input, buat("span", "", prioritas));
            pilihan.append(chip);
        }
        const tombol = buat("button", "tombol tombol-kuning", "Ambil Nomer");
        tombol.type = "button";
        tombol.dataset.kode = jenis.kode;
        kartu.append(atas, pilihan, tombol);
        totalTiket.set(jenis.kode, total);
        return kartu;
    }
    // prioritas yang lagi dicentang per kartu, supaya pilihan gak hilang pas kartu dibuat ulang
    function ambilPilihan() {
        const hasil = new Map();
        for (const input of wadahKartu.querySelectorAll("input:checked")) {
            const kode = input.closest(".kartu")?.dataset.kode;
            if (kode)
                hasil.set(kode, cekPrioritas(input.value));
        }
        return hasil;
    }
    function render() {
        const jenisAktif = bacaJenis().filter((j) => j.aktif);
        const tiket = bacaTiket();
        // jenis baru dari dashboard otomatis muncul di sini, yang nonaktif atau dihapus hilang
        const tanda = jenisAktif.map((j) => `${j.kode}:${j.nama}`).join("|");
        if (tanda !== tandaJenis) {
            const pilihan = ambilPilihan();
            tandaJenis = tanda;
            totalTiket.clear();
            wadahKartu.replaceChildren(...jenisAktif.map((j) => buatKartu(j, pilihan.get(j.kode) ?? "Normal")));
            if (jenisAktif.length === 0) {
                wadahKartu.append(buat("p", "kosong", "Belum ada jenis antrian yang aktif."));
            }
        }
        // label kartunya "Total tiket hari ini", jadi tiket hari sebelumnya gak ikut dihitung
        const hariIni = new Date().toDateString();
        for (const jenis of jenisAktif) {
            const el = totalTiket.get(jenis.kode);
            const jumlah = tiket.filter((t) => t.kode === jenis.kode && new Date(t.dibuat).toDateString() === hariIni).length;
            const teksBaru = `${jumlah} Tiket`;
            // angkanya lompat kalau berubah (bukan pas pertama dimuat), tanda tiketnya beneran masuk
            if (el && el.textContent !== teksBaru) {
                const pertamaKali = el.textContent === "";
                el.textContent = teksBaru;
                if (!pertamaKali) {
                    el.classList.remove("sorot");
                    el.getBoundingClientRect();
                    el.classList.add("sorot");
                }
            }
        }
    }
    // nomor diambil dari tiket yang masih ada, jadi habis reset otomatis mulai dari 001 lagi (sama dengan index.ts)
    function nomorBerikutnya(kode, semuaTiket) {
        let terbesar = 0;
        for (const t of semuaTiket) {
            if (t.kode === kode)
                terbesar = Math.max(terbesar, Number(t.nomor.split("-")[1]) || 0);
        }
        return `${kode}-${String(terbesar + 1).padStart(3, "0")}`;
    }
    function ambilNomor(kode, prioritas) {
        // data dibaca ulang dari localStorage tepat sebelum nulis, supaya perubahan dari tab operator gak ketimpa
        const jenis = bacaJenis().find((j) => j.kode === kode);
        if (!jenis || !jenis.aktif) {
            tampilkanNotif("Jenis antrian ini sudah tidak aktif.", true);
            render();
            return;
        }
        const semuaTiket = bacaTiket();
        const tiket = {
            nomor: nomorBerikutnya(kode, semuaTiket),
            kode,
            prioritas,
            status: "menunggu",
            dibuat: Date.now(),
        };
        semuaTiket.push(tiket);
        try {
            localStorage.setItem(KUNCI_TIKET, JSON.stringify(semuaTiket));
        }
        catch {
            tampilkanNotif("Tiket gagal disimpan, coba lagi.", true);
            return;
        }
        render();
        tampilkanTiket(tiket, jenis.nama);
    }
    wadahKartu.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLButtonElement))
            return;
        const kode = target.dataset.kode;
        if (!kode)
            return;
        const dipilih = target.closest(".kartu")?.querySelector("input:checked");
        ambilNomor(kode, cekPrioritas(dipilih ? dipilih.value : ""));
    });
    // kalau sesi dihapus (logout di tab lain) langsung balik ke login, kalau tidak data diperbarui
    function segarkan() {
        if (ambilSesi() === null) {
            location.replace("login.html");
            return;
        }
        render();
    }
    window.addEventListener("storage", segarkan);
    window.setInterval(segarkan, JEDA_POLLING);
    render();
})();
