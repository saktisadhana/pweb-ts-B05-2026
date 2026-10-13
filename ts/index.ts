type Prioritas = "Normal" | "Lansia" | "Disabilitas" | "VIP";
type StatusTiket = "menunggu" | "dipanggil" | "selesai" | "dilewati";

// sesi ditulis login.ts setelah POST https://dummyjson.com/auth/login
interface Sesi {
  token: string;
  role: string;
  nama: string;
}

interface JenisAntrian {
  kode: string;
  nama: string;
  aktif: boolean;
}

interface Tiket {
  nomor: string;
  kode: string;
  prioritas: Prioritas;
  status: StatusTiket;
  dibuat: number;
}

// key localStorage ini dipakai bareng halaman lain (ambil antrian, operator, layar)
const KUNCI_SESI = "sesi";
const KUNCI_JENIS = "jenisAntrian";
const KUNCI_TIKET = "tiketAntrian";

const ROLE_BOLEH = ["admin", "moderator"];

// makin kecil index-nya makin didahulukan pas dipanggil
const URUTAN_PRIORITAS: Prioritas[] = ["Disabilitas", "Lansia", "VIP", "Normal"];

function bacaJson<T>(kunci: string, cadangan: T): T {
  const mentah = localStorage.getItem(kunci);
  if (mentah === null) return cadangan;
  try {
    return JSON.parse(mentah);
  } catch {
    return cadangan;
  }
}

function ambilSesi(): Sesi | null {
  const sesi = bacaJson<Partial<Sesi> | null>(KUNCI_SESI, null);
  if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string") return null;
  return { token: sesi.token, role: sesi.role, nama: sesi.nama ?? "-" };
}

// auth guard + role guard, dicek paling awal sebelum halaman dipakai
const sesi = ambilSesi();
const bolehMasuk = sesi !== null && ROLE_BOLEH.includes(sesi.role);
if (!bolehMasuk) {
  location.replace("login.html");
}

function ambil<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Elemen ${selector} tidak ketemu`);
  return el;
}

const namaUser = ambil<HTMLElement>("#nama-user");
const roleUser = ambil<HTMLElement>("#role-user");
const tombolLogout = ambil<HTMLButtonElement>("#tombol-logout");
const formJenis = ambil<HTMLFormElement>("#form-jenis");
const inputKode = ambil<HTMLInputElement>("#input-kode");
const inputNama = ambil<HTMLInputElement>("#input-nama");
const daftarJenis = ambil<HTMLUListElement>("#daftar-jenis");
const formTerbit = ambil<HTMLFormElement>("#form-terbit");
const pilihJenis = ambil<HTMLSelectElement>("#pilih-jenis");
const pilihPrioritas = ambil<HTMLSelectElement>("#pilih-prioritas");
const tombolTerbit = ambil<HTMLButtonElement>("#tombol-terbit");
const daftarTiket = ambil<HTMLDivElement>("#daftar-tiket");
const tombolReset = ambil<HTMLButtonElement>("#tombol-reset");
const notif = ambil<HTMLParagraphElement>("#notif");
const dialog = ambil<HTMLDialogElement>("#dialog-konfirmasi");
const dialogPesan = ambil<HTMLParagraphElement>("#dialog-pesan");
const templateJenis = ambil<HTMLTemplateElement>("#template-jenis");
const templateTiket = ambil<HTMLTemplateElement>("#template-tiket");

let timerNotif: number | undefined;

function tampilkanNotif(pesan: string, gagal = false, durasi = 2500): void {
  notif.textContent = pesan;
  notif.classList.toggle("gagal", gagal);
  notif.classList.add("muncul");
  clearTimeout(timerNotif);
  timerNotif = window.setTimeout(() => notif.classList.remove("muncul"), durasi);
}

// pengganti confirm() biar tampilannya sesuai desain, Escape otomatis dianggap batal
function konfirmasi(pesan: string): Promise<boolean> {
  dialogPesan.textContent = pesan;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "ya"), { once: true });
  });
}

const JENIS_AWAL: JenisAntrian[] = [
  { kode: "A", nama: "UMUM-1", aktif: true },
  { kode: "B", nama: "UMUM-2", aktif: true },
  { kode: "C", nama: "UMUM-3", aktif: true },
  { kode: "G", nama: "GIGI", aktif: true },
  { kode: "F", nama: "FARMASI", aktif: true },
  { kode: "P", nama: "PSIKOLOG", aktif: true },
];

let daftarJenisAntrian: JenisAntrian[] = [];
let daftarTiketAntrian: Tiket[] = [];

// baris yang barusan berubah, dikasih animasi sekali di render berikutnya
let sorotKode = "";
let sorotNomor = "";

function muatData(): void {
  const jenisBaru = JENIS_AWAL.map((j) => ({ ...j }));
  const jenis = bacaJson<unknown>(KUNCI_JENIS, jenisBaru);
  const tiket = bacaJson<unknown>(KUNCI_TIKET, []);

  if (Array.isArray(jenis) && Array.isArray(tiket)) {
    daftarJenisAntrian = jenis;
    daftarTiketAntrian = tiket;
  } else {
    daftarJenisAntrian = jenisBaru;
    daftarTiketAntrian = [];
    tampilkanNotif("Data antrian di browser rusak, jadi dikembalikan ke awal.", true);
  }
}

function simpan(): void {
  localStorage.setItem(KUNCI_JENIS, JSON.stringify(daftarJenisAntrian));
  localStorage.setItem(KUNCI_TIKET, JSON.stringify(daftarTiketAntrian));
}

function cariJenis(kode: string): JenisAntrian | undefined {
  return daftarJenisAntrian.find((j) => j.kode === kode);
}

function jumlahMenunggu(kode: string): number {
  return daftarTiketAntrian.filter((t) => t.kode === kode && t.status === "menunggu").length;
}

// nomor diambil dari tiket yang masih ada, jadi habis reset otomatis mulai dari 001 lagi
function nomorBerikutnya(kode: string): string {
  let terbesar = 0;
  for (const t of daftarTiketAntrian) {
    if (t.kode === kode) terbesar = Math.max(terbesar, Number(t.nomor.split("-")[1]) || 0);
  }
  return `${kode}-${String(terbesar + 1).padStart(3, "0")}`;
}

function isiTeks(induk: ParentNode, selector: string, teks: string): void {
  const el = induk.querySelector(selector);
  if (el) el.textContent = teks;
}

// lang "id-ID" aja gak cukup, browser tetap pakai suara default (biasanya bahasa inggris).
// jadi suara bahasa indonesianya dicari manual dari daftar suara yang ada di perangkat
let suaraIndonesia: SpeechSynthesisVoice | undefined;
let sudahDiingatkan = false;

function cariSuaraIndonesia(): void {
  const semua = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("id"));
  // suara online (Google, Microsoft Natural) jauh lebih natural dari suara bawaan windows
  suaraIndonesia = semua.find((v) => /google|natural|online/i.test(v.name)) ?? semua[0];
}

if ("speechSynthesis" in window) {
  cariSuaraIndonesia();
  // daftar suara di chrome baru siap belakangan, jadi dicari ulang pas sudah ke-load
  speechSynthesis.addEventListener("voiceschanged", cariSuaraIndonesia);
}

function umumkan(tiket: Tiket): void {
  if (!("speechSynthesis" in window)) return;

  const [huruf, angka] = tiket.nomor.split("-");
  // "UMUM-1" dibaca "umum satu", strip-nya diganti spasi biar gak dieja aneh
  const loket = (cariJenis(tiket.kode)?.nama ?? "").replace(/-/g, " ");
  const suara = new SpeechSynthesisUtterance(
    `Nomor antrian, ${huruf}, ${Number(angka)}. Silakan menuju loket ${loket}.`
  );
  suara.lang = "id-ID";
  suara.rate = 0.9;
  if (suaraIndonesia) suara.voice = suaraIndonesia;
  speechSynthesis.cancel();
  speechSynthesis.speak(suara);

  if (!suaraIndonesia && !sudahDiingatkan) {
    sudahDiingatkan = true;
    tampilkanNotif(
      "Suara Bahasa Indonesia belum ada di perangkat ini. Buka lewat Chrome atau Edge, atau tambahkan suara Indonesia di Pengaturan Windows > Waktu & bahasa > Ucapan.",
      true,
      8000
    );
  }
}

function renderJenis(): void {
  daftarJenis.innerHTML = "";

  if (daftarJenisAntrian.length === 0) {
    daftarJenis.innerHTML = `<li class="kosong">Belum ada jenis antrian. Tambah dulu lewat form di atas.</li>`;
    return;
  }

  for (const jenis of daftarJenisAntrian) {
    const li = document.importNode(templateJenis.content, true).querySelector<HTMLLIElement>("li");
    if (!li) continue;

    li.dataset.kode = jenis.kode;
    li.classList.toggle("item-nonaktif", !jenis.aktif);
    li.classList.toggle("item-baru", jenis.kode === sorotKode);
    isiTeks(li, ".isi-nama", jenis.nama);
    isiTeks(li, ".isi-kode", `(${jenis.kode})`);

    let status = `${jumlahMenunggu(jenis.kode)} Menunggu`;
    if (!jenis.aktif) status += ", nonaktif";
    isiTeks(li, ".isi-status", status);
    isiTeks(li, '[data-aksi="toggle"]', jenis.aktif ? "Nonaktifkan" : "Aktifkan");

    daftarJenis.append(li);
  }
}

function renderPilihanJenis(): void {
  const yangDipilih = pilihJenis.value;
  const aktif = daftarJenisAntrian.filter((j) => j.aktif);

  pilihJenis.innerHTML = "";
  for (const jenis of aktif) {
    pilihJenis.add(new Option(`${jenis.nama} (${jenis.kode})`, jenis.kode));
  }

  if (aktif.length === 0) {
    pilihJenis.add(new Option("Tidak ada jenis aktif", ""));
  } else if (aktif.some((j) => j.kode === yangDipilih)) {
    pilihJenis.value = yangDipilih;
  }

  tombolTerbit.disabled = aktif.length === 0;
}

function bandingkanTiket(a: Tiket, b: Tiket): number {
  // yang lagi dipanggil selalu di atas
  if (a.status !== b.status) return a.status === "dipanggil" ? -1 : 1;
  const selisih = URUTAN_PRIORITAS.indexOf(a.prioritas) - URUTAN_PRIORITAS.indexOf(b.prioritas);
  return selisih !== 0 ? selisih : a.dibuat - b.dibuat;
}

function buatTombol(teks: string, aksi: string, kelas: string): HTMLButtonElement {
  const tombol = document.createElement("button");
  tombol.type = "button";
  tombol.className = `tombol tombol-kecil ${kelas}`;
  tombol.dataset.aksi = aksi;
  tombol.textContent = teks;
  return tombol;
}

function renderTiket(): void {
  daftarTiket.innerHTML = "";
  let adaTiket = false;

  for (const jenis of daftarJenisAntrian) {
    const tiketAktif = daftarTiketAntrian
      .filter((t) => t.kode === jenis.kode && (t.status === "menunggu" || t.status === "dipanggil"))
      .sort(bandingkanTiket);

    if (tiketAktif.length === 0) continue;
    adaTiket = true;

    const grup = document.createElement("section");
    grup.className = "grup-tiket";
    const judul = document.createElement("h3");
    judul.textContent = jenis.nama;
    const ul = document.createElement("ul");
    ul.className = "daftar";
    grup.append(judul, ul);

    for (const tiket of tiketAktif) {
      const li = document.importNode(templateTiket.content, true).querySelector<HTMLLIElement>("li");
      if (!li) continue;

      li.dataset.nomor = tiket.nomor;
      li.classList.toggle("item-baru", tiket.nomor === sorotNomor);
      isiTeks(li, ".isi-nomor", tiket.nomor);
      isiTeks(li, ".isi-prioritas", `(${tiket.prioritas})`);
      isiTeks(li, ".isi-status", tiket.status === "dipanggil" ? "Dipanggil" : "Menunggu");

      const wadahTombol = li.querySelector(".item-tombol");
      if (tiket.status === "dipanggil") {
        wadahTombol?.append(
          buatTombol("Panggil Ulang", "panggil", ""),
          buatTombol("Selesai", "selesai", "tombol-selesai")
        );
      } else {
        wadahTombol?.append(
          buatTombol("Lewati", "lewati", "tombol-merah"),
          buatTombol("Panggil", "panggil", "")
        );
      }
      ul.append(li);
    }

    daftarTiket.append(grup);
  }

  if (!adaTiket) {
    daftarTiket.innerHTML = `<p class="kosong">Belum ada tiket yang menunggu. Terbitkan tiket lewat form di atas.</p>`;
  }
}

function render(): void {
  renderJenis();
  renderPilihanJenis();
  renderTiket();
  sorotKode = "";
  sorotNomor = "";
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
  } else if (daftarJenisAntrian.some((j) => j.kode.toUpperCase() === kode)) {
    inputKode.setCustomValidity(`Kode ${kode} sudah dipakai.`);
  }

  if (nama === "") {
    inputNama.setCustomValidity("Nama layanan belum diisi.");
  } else if (daftarJenisAntrian.some((j) => j.nama.toLowerCase() === nama.toLowerCase())) {
    inputNama.setCustomValidity(`Nama ${nama} sudah ada.`);
  }

  if (!formJenis.reportValidity()) return;

  daftarJenisAntrian.push({ kode, nama, aktif: true });
  sorotKode = kode;
  simpan();
  render();
  formJenis.reset();
  inputKode.focus();
  tampilkanNotif(`Jenis antrian ${nama} (${kode}) ditambahkan.`);
});

daftarJenis.addEventListener("click", async (e) => {
  const target = e.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const kode = target.closest<HTMLLIElement>("li")?.dataset.kode;
  const jenis = kode ? cariJenis(kode) : undefined;
  if (!jenis) return;

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
    if (sisa > 0) pesan += ` ${sisa} tiket di dalamnya ikut terhapus.`;
    if (!(await konfirmasi(pesan))) return;

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
  const tiket: Tiket = {
    nomor: nomorBerikutnya(jenis.kode),
    kode: jenis.kode,
    prioritas,
    status: "menunggu",
    dibuat: Date.now(),
  };
  daftarTiketAntrian.push(tiket);
  sorotNomor = tiket.nomor;
  simpan();
  render();
  tampilkanNotif(`Tiket ${tiket.nomor} (${prioritas}) diterbitkan.`);
});

daftarTiket.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const nomor = target.closest<HTMLLIElement>("li")?.dataset.nomor;
  const tiket = daftarTiketAntrian.find((t) => t.nomor === nomor);
  if (!tiket) return;

  const aksi = target.dataset.aksi;
  if (aksi === "panggil") {
    // satu loket cuma manggil satu orang, yang sebelumnya dianggap selesai
    for (const t of daftarTiketAntrian) {
      if (t.kode === tiket.kode && t.status === "dipanggil" && t !== tiket) t.status = "selesai";
    }
    tiket.status = "dipanggil";
    sorotNomor = tiket.nomor;
    tampilkanNotif(`Memanggil ${tiket.nomor}.`);
    umumkan(tiket);
  } else if (aksi === "lewati") {
    tiket.status = "dilewati";
    tampilkanNotif(`${tiket.nomor} dilewati.`);
  } else if (aksi === "selesai") {
    tiket.status = "selesai";
    tampilkanNotif(`${tiket.nomor} selesai.`);
  }

  simpan();
  render();
});

tombolReset.addEventListener("click", async () => {
  const yakin = await konfirmasi(
    "Reset antrian? Semua tiket dihapus dan nomor mulai lagi dari 001. Jenis antrian tetap ada."
  );
  if (!yakin) return;

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
  } else if (e.key === KUNCI_JENIS || e.key === KUNCI_TIKET) {
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
