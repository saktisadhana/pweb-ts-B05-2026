"use strict";
// key localStorage ini dipakai bareng halaman lain (ambil antrian, operator, layar)
const KUNCI_SESI = "sesi";
const KUNCI_JENIS = "jenisAntrian";
const KUNCI_TIKET = "tiketAntrian";
const ROLE_BOLEH = ["admin", "moderator"];
// makin kecil index-nya makin didahulukan pas dipanggil
const URUTAN_PRIORITAS = ["Disabilitas", "Lansia", "VIP", "Normal"];
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
// auth guard + role guard, dicek paling awal sebelum halaman dipakai
const sesi = ambilSesi();
const bolehMasuk = sesi !== null && ROLE_BOLEH.includes(sesi.role);
if (!bolehMasuk) {
    location.replace("login.html");
}
function ambil(selector) {
    const el = document.querySelector(selector);
    if (!el)
        throw new Error(`Elemen ${selector} tidak ketemu`);
    return el;
}
const namaUser = ambil("#nama-user");
const roleUser = ambil("#role-user");
const tombolLogout = ambil("#tombol-logout");
const formJenis = ambil("#form-jenis");
const inputKode = ambil("#input-kode");
const inputNama = ambil("#input-nama");
const daftarJenis = ambil("#daftar-jenis");
const formTerbit = ambil("#form-terbit");
const pilihJenis = ambil("#pilih-jenis");
const pilihPrioritas = ambil("#pilih-prioritas");
const tombolTerbit = ambil("#tombol-terbit");
const daftarTiket = ambil("#daftar-tiket");
const tombolReset = ambil("#tombol-reset");
const notif = ambil("#notif");
const dialog = ambil("#dialog-konfirmasi");
const dialogPesan = ambil("#dialog-pesan");
const templateJenis = ambil("#template-jenis");
const templateTiket = ambil("#template-tiket");
let timerNotif;
function tampilkanNotif(pesan, gagal = false) {
    notif.textContent = pesan;
    notif.classList.toggle("gagal", gagal);
    notif.classList.add("muncul");
    clearTimeout(timerNotif);
    timerNotif = window.setTimeout(() => notif.classList.remove("muncul"), 2500);
}
// pengganti confirm() biar tampilannya sesuai desain, Escape otomatis dianggap batal
function konfirmasi(pesan) {
    dialogPesan.textContent = pesan;
    dialog.returnValue = "";
    dialog.showModal();
    return new Promise((resolve) => {
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "ya"), { once: true });
    });
}
const JENIS_AWAL = [
    { kode: "A", nama: "UMUM-1", aktif: true },
    { kode: "B", nama: "UMUM-2", aktif: true },
    { kode: "C", nama: "UMUM-3", aktif: true },
    { kode: "G", nama: "GIGI", aktif: true },
    { kode: "F", nama: "FARMASI", aktif: true },
    { kode: "P", nama: "PSIKOLOG", aktif: true },
];
let daftarJenisAntrian = [];
let daftarTiketAntrian = [];
function muatData() {
    const jenisBaru = JENIS_AWAL.map((j) => ({ ...j }));
    const jenis = bacaJson(KUNCI_JENIS, jenisBaru);
    const tiket = bacaJson(KUNCI_TIKET, []);
    if (Array.isArray(jenis) && Array.isArray(tiket)) {
        daftarJenisAntrian = jenis;
        daftarTiketAntrian = tiket;
    }
    else {
        daftarJenisAntrian = jenisBaru;
        daftarTiketAntrian = [];
        tampilkanNotif("Data antrian di browser rusak, jadi dikembalikan ke awal.", true);
    }
}
function simpan() {
    localStorage.setItem(KUNCI_JENIS, JSON.stringify(daftarJenisAntrian));
    localStorage.setItem(KUNCI_TIKET, JSON.stringify(daftarTiketAntrian));
}
function cariJenis(kode) {
    return daftarJenisAntrian.find((j) => j.kode === kode);
}
function jumlahMenunggu(kode) {
    return daftarTiketAntrian.filter((t) => t.kode === kode && t.status === "menunggu").length;
}
// nomor diambil dari tiket yang masih ada, jadi habis reset otomatis mulai dari 001 lagi
function nomorBerikutnya(kode) {
    let terbesar = 0;
    for (const t of daftarTiketAntrian) {
        if (t.kode === kode)
            terbesar = Math.max(terbesar, Number(t.nomor.split("-")[1]) || 0);
    }
    return `${kode}-${String(terbesar + 1).padStart(3, "0")}`;
}
function isiTeks(induk, selector, teks) {
    const el = induk.querySelector(selector);
    if (el)
        el.textContent = teks;
}
function umumkan(tiket) {
    if (!("speechSynthesis" in window))
        return;
    const [huruf, angka] = tiket.nomor.split("-");
    const loket = cariJenis(tiket.kode)?.nama ?? "";
    const suara = new SpeechSynthesisUtterance(`Nomor antrian ${huruf} ${Number(angka)}, silakan menuju ${loket}`);
    suara.lang = "id-ID";
    speechSynthesis.cancel();
    speechSynthesis.speak(suara);
}
function renderJenis() {
    daftarJenis.innerHTML = "";
    if (daftarJenisAntrian.length === 0) {
        daftarJenis.innerHTML = `<li class="kosong">Belum ada jenis antrian. Tambah dulu lewat form di atas.</li>`;
        return;
    }
    for (const jenis of daftarJenisAntrian) {
        const li = document.importNode(templateJenis.content, true).querySelector("li");
        if (!li)
            continue;
        li.dataset.kode = jenis.kode;
        li.classList.toggle("item-nonaktif", !jenis.aktif);
        isiTeks(li, ".isi-nama", jenis.nama);
        isiTeks(li, ".isi-kode", `(${jenis.kode})`);
        let status = `${jumlahMenunggu(jenis.kode)} Menunggu`;
        if (!jenis.aktif)
            status += ", nonaktif";
        isiTeks(li, ".isi-status", status);
        isiTeks(li, '[data-aksi="toggle"]', jenis.aktif ? "Nonaktifkan" : "Aktifkan");
        daftarJenis.append(li);
    }
}
function renderPilihanJenis() {
    const yangDipilih = pilihJenis.value;
    const aktif = daftarJenisAntrian.filter((j) => j.aktif);
    pilihJenis.innerHTML = "";
    for (const jenis of aktif) {
        pilihJenis.add(new Option(`${jenis.nama} (${jenis.kode})`, jenis.kode));
    }
    if (aktif.length === 0) {
        pilihJenis.add(new Option("Tidak ada jenis aktif", ""));
    }
    else if (aktif.some((j) => j.kode === yangDipilih)) {
        pilihJenis.value = yangDipilih;
    }
    tombolTerbit.disabled = aktif.length === 0;
}
function bandingkanTiket(a, b) {
    // yang lagi dipanggil selalu di atas
    if (a.status !== b.status)
        return a.status === "dipanggil" ? -1 : 1;
    const selisih = URUTAN_PRIORITAS.indexOf(a.prioritas) - URUTAN_PRIORITAS.indexOf(b.prioritas);
    return selisih !== 0 ? selisih : a.dibuat - b.dibuat;
}
function buatTombol(teks, aksi, kelas) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.className = `tombol tombol-kecil ${kelas}`;
    tombol.dataset.aksi = aksi;
    tombol.textContent = teks;
    return tombol;
}
function renderTiket() {
    daftarTiket.innerHTML = "";
    let adaTiket = false;
    for (const jenis of daftarJenisAntrian) {
        const tiketAktif = daftarTiketAntrian
            .filter((t) => t.kode === jenis.kode && (t.status === "menunggu" || t.status === "dipanggil"))
            .sort(bandingkanTiket);
        if (tiketAktif.length === 0)
            continue;
        adaTiket = true;
        const grup = document.createElement("section");
        grup.className = "grup-tiket";
        const judul = document.createElement("h3");
        judul.textContent = jenis.nama;
        const ul = document.createElement("ul");
        ul.className = "daftar";
        grup.append(judul, ul);
        for (const tiket of tiketAktif) {
            const li = document.importNode(templateTiket.content, true).querySelector("li");
            if (!li)
                continue;
            li.dataset.nomor = tiket.nomor;
            isiTeks(li, ".isi-nomor", tiket.nomor);
            isiTeks(li, ".isi-prioritas", `(${tiket.prioritas})`);
            isiTeks(li, ".isi-status", tiket.status === "dipanggil" ? "Dipanggil" : "Menunggu");
            const wadahTombol = li.querySelector(".item-tombol");
            if (tiket.status === "dipanggil") {
                wadahTombol?.append(buatTombol("Panggil Ulang", "panggil", ""), buatTombol("Selesai", "selesai", "tombol-selesai"));
            }
            else {
                wadahTombol?.append(buatTombol("Lewati", "lewati", "tombol-merah"), buatTombol("Panggil", "panggil", ""));
            }
            ul.append(li);
        }
        daftarTiket.append(grup);
    }
    if (!adaTiket) {
        daftarTiket.innerHTML = `<p class="kosong">Belum ada tiket yang menunggu. Terbitkan tiket lewat form di atas.</p>`;
    }
}
function render() {
    renderJenis();
    renderPilihanJenis();
    renderTiket();
}
// kode wajib huruf kapital, jadi langsung dibesarkan pas diketik
inputKode.addEventListener("input", () => {
    inputKode.value = inputKode.value.toUpperCase();
    inputKode.setCustomValidity("");
});
inputNama.addEventListener("input", () => inputNama.setCustomValidity(""));
formJenis.addEventListener("submit", (e) => {
    e.preventDefault();
    const kode = inputKode.value.trim().toUpperCase();
    const nama = inputNama.value.trim();
    inputKode.setCustomValidity("");
    inputNama.setCustomValidity("");
    if (!/^[A-Z]$/.test(kode)) {
        inputKode.setCustomValidity("Kode harus 1 huruf kapital (A sampai Z).");
    }
    else if (daftarJenisAntrian.some((j) => j.kode.toUpperCase() === kode)) {
        inputKode.setCustomValidity(`Kode ${kode} sudah dipakai.`);
    }
    if (nama === "") {
        inputNama.setCustomValidity("Nama layanan belum diisi.");
    }
    else if (daftarJenisAntrian.some((j) => j.nama.toLowerCase() === nama.toLowerCase())) {
        inputNama.setCustomValidity(`Nama ${nama} sudah ada.`);
    }
    if (!formJenis.reportValidity())
        return;
    daftarJenisAntrian.push({ kode, nama, aktif: true });
    simpan();
    render();
    formJenis.reset();
    inputKode.focus();
    tampilkanNotif(`Jenis antrian ${nama} (${kode}) ditambahkan.`);
});
daftarJenis.addEventListener("click", async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement))
        return;
    const kode = target.closest("li")?.dataset.kode;
    const jenis = kode ? cariJenis(kode) : undefined;
    if (!jenis)
        return;
    if (target.dataset.aksi === "toggle") {
        jenis.aktif = !jenis.aktif;
        simpan();
        render();
        tampilkanNotif(`${jenis.nama} ${jenis.aktif ? "diaktifkan" : "dinonaktifkan"}.`);
        return;
    }
    if (target.dataset.aksi === "hapus") {
        const sisa = daftarTiketAntrian.filter((t) => t.kode === jenis.kode).length;
        let pesan = `Hapus jenis antrian ${jenis.nama}?`;
        if (sisa > 0)
            pesan += ` ${sisa} tiket di dalamnya ikut terhapus.`;
        if (!(await konfirmasi(pesan)))
            return;
        daftarJenisAntrian = daftarJenisAntrian.filter((j) => j.kode !== jenis.kode);
        daftarTiketAntrian = daftarTiketAntrian.filter((t) => t.kode !== jenis.kode);
        simpan();
        render();
        tampilkanNotif(`${jenis.nama} dihapus.`);
    }
});
formTerbit.addEventListener("submit", (e) => {
    e.preventDefault();
    const jenis = cariJenis(pilihJenis.value);
    if (!jenis || !jenis.aktif) {
        tampilkanNotif("Pilih jenis antrian yang aktif dulu.", true);
        return;
    }
    const prioritas = URUTAN_PRIORITAS.find((p) => p === pilihPrioritas.value) ?? "Normal";
    const tiket = {
        nomor: nomorBerikutnya(jenis.kode),
        kode: jenis.kode,
        prioritas,
        status: "menunggu",
        dibuat: Date.now(),
    };
    daftarTiketAntrian.push(tiket);
    simpan();
    render();
    tampilkanNotif(`Tiket ${tiket.nomor} (${prioritas}) diterbitkan.`);
});
daftarTiket.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLButtonElement))
        return;
    const nomor = target.closest("li")?.dataset.nomor;
    const tiket = daftarTiketAntrian.find((t) => t.nomor === nomor);
    if (!tiket)
        return;
    const aksi = target.dataset.aksi;
    if (aksi === "panggil") {
        // satu loket cuma manggil satu orang, yang sebelumnya dianggap selesai
        for (const t of daftarTiketAntrian) {
            if (t.kode === tiket.kode && t.status === "dipanggil" && t !== tiket)
                t.status = "selesai";
        }
        tiket.status = "dipanggil";
        umumkan(tiket);
        tampilkanNotif(`Memanggil ${tiket.nomor}.`);
    }
    else if (aksi === "lewati") {
        tiket.status = "dilewati";
        tampilkanNotif(`${tiket.nomor} dilewati.`);
    }
    else if (aksi === "selesai") {
        tiket.status = "selesai";
        tampilkanNotif(`${tiket.nomor} selesai.`);
    }
    simpan();
    render();
});
tombolReset.addEventListener("click", async () => {
    const yakin = await konfirmasi("Reset antrian? Semua tiket dihapus dan nomor mulai lagi dari 001. Jenis antrian tetap ada.");
    if (!yakin)
        return;
    daftarTiketAntrian = [];
    simpan();
    render();
    tampilkanNotif("Antrian sudah direset.");
});
// logout cuma hapus sesi, data antrian tetap disimpan
tombolLogout.addEventListener("click", () => {
    localStorage.removeItem(KUNCI_SESI);
    location.replace("login.html");
});
// kalau dashboard dibuka di 2 tab, tab yang lain ikut update
window.addEventListener("storage", (e) => {
    if (e.key === KUNCI_SESI && ambilSesi() === null) {
        location.replace("login.html");
    }
    else if (e.key === KUNCI_JENIS || e.key === KUNCI_TIKET) {
        muatData();
        render();
    }
});
if (sesi && bolehMasuk) {
    namaUser.textContent = sesi.nama;
    roleUser.textContent = sesi.role;
    muatData();
    // langsung disimpan biar halaman ambil antrian bisa baca jenis default
    simpan();
    render();
}
