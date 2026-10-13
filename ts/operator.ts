// dibungkus fungsi biar type dan const di sini gak bentrok sama file .ts lain
(() => {
  type Prioritas = "Normal" | "Lansia" | "Disabilitas" | "VIP";
  type StatusTiket = "menunggu" | "dipanggil" | "selesai" | "dilewati";

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

  // key dan bentuk datanya sama persis dengan index.ts
  const KUNCI_SESI = "sesi";
  const KUNCI_JENIS = "jenisAntrian";
  const KUNCI_TIKET = "tiketAntrian";
  const URUTAN_PRIORITAS: Prioritas[] = ["Disabilitas", "Lansia", "VIP", "Normal"];

  const JENIS_AWAL: JenisAntrian[] = [
    { kode: "A", nama: "UMUM-1", aktif: true },
    { kode: "B", nama: "UMUM-2", aktif: true },
    { kode: "C", nama: "UMUM-3", aktif: true },
    { kode: "G", nama: "GIGI", aktif: true },
    { kode: "F", nama: "FARMASI", aktif: true },
    { kode: "P", nama: "PSIKOLOG", aktif: true },
  ];

  function bacaJson<T>(kunci: string, cadangan: T): T {
    const nilai = localStorage.getItem(kunci);
    if (nilai === null) return cadangan;
    try {
      return JSON.parse(nilai);
    } catch {
      return cadangan;
    }
  }

  function ambilSesi(): Sesi | null {
    const sesi = bacaJson<Partial<Sesi> | null>(KUNCI_SESI, null);
    if (!sesi || typeof sesi.token !== "string" || typeof sesi.role !== "string") return null;
    return { token: sesi.token, role: sesi.role.toLowerCase(), nama: sesi.nama ?? "-" };
  }

  // auth guard + role guard sama kayak dashboard: selain admin/moderator balik ke login
  const sesi = ambilSesi();
  if (!sesi || (sesi.role !== "admin" && sesi.role !== "moderator")) {
    location.replace("login.html");
    return;
  }

  function bacaJenis(): JenisAntrian[] {
    const jenis = bacaJson<unknown>(KUNCI_JENIS, JENIS_AWAL);
    return Array.isArray(jenis) ? jenis : [];
  }

  function bacaTiket(): Tiket[] {
    const tiket = bacaJson<unknown>(KUNCI_TIKET, []);
    return Array.isArray(tiket) ? tiket : [];
  }

  function simpanTiket(tiket: Tiket[]): void {
    localStorage.setItem(KUNCI_TIKET, JSON.stringify(tiket));
  }

  function ambil<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Elemen ${selector} tidak ketemu`);
    return el;
  }

  function buat<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    kelas = "",
    teks = ""
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks) el.textContent = teks;
    return el;
  }

  const wadahKartu = ambil<HTMLElement>(".panel-utama");

  // Exit = keluar akun, jadi sesinya dihapus dulu (sama seperti logout di dashboard)
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href="login.html"]')) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      localStorage.removeItem(KUNCI_SESI);
      location.replace("login.html");
    });
  }

  function tiketBerikutnya(tiket: Tiket[], kode: string): Tiket | undefined {
    return tiket
      .filter((item) => item.kode === kode && item.status === "menunggu")
      .sort((a, b) => {
        const prioritasA = URUTAN_PRIORITAS.indexOf(a.prioritas);
        const prioritasB = URUTAN_PRIORITAS.indexOf(b.prioritas);
        return prioritasA - prioritasB || a.dibuat - b.dibuat;
      })[0];
  }

  interface KartuRef {
    menunggu: HTMLElement;
    dipanggil: HTMLElement;
    berikutnya: HTMLElement;
    kosong: HTMLElement;
    tombolLewati: HTMLButtonElement;
    tombolSelesai: HTMLButtonElement;
    tombolPanggil: HTMLButtonElement;
  }

  const kartuAda = new Map<string, KartuRef>();
  const dipanggilTerakhir = new Map<string, string>();
  let tandaJenis = "";

  // class dilepas dulu, dipaksa reflow, baru dipasang lagi biar animasinya keulang
  function sorot(el: Element): void {
    el.classList.remove("sorot");
    el.getBoundingClientRect();
    el.classList.add("sorot");
  }

  function buatBlok(keterangan: string) {
    const blok = buat("div", "blok-info");
    const angka = buat("p", "angka");
    blok.append(angka, buat("p", "keterangan", keterangan));
    return { blok, angka };
  }

  // struktur dan class-nya sama dengan kartu operator di desain figma
  function buatKartu(jenis: JenisAntrian): HTMLElement {
    const kartu = buat("article", "kartu");

    const nama = buat("h2", "nama-antrian");
    nama.append(buat("b", "", jenis.nama), buat("i", "", `(${jenis.kode})`));
    const menunggu = buat("p", "keterangan");
    const blokNama = buat("div", "blok-info");
    blokNama.append(nama, menunggu);
    const atas = buat("div", "kartu-atas");
    atas.append(blokNama);

    // Lewati = orangnya gak datang, Selesai = sudah dilayani. Dua-duanya gak otomatis manggil berikutnya
    const tombolLewati = buat("button", "tombol tombol-kecil tombol-merah", "Lewati");
    tombolLewati.type = "button";
    tombolLewati.dataset.kode = jenis.kode;
    tombolLewati.dataset.aksi = "lewati";

    const tombolSelesai = buat("button", "tombol tombol-kecil", "Selesai");
    tombolSelesai.type = "button";
    tombolSelesai.dataset.kode = jenis.kode;
    tombolSelesai.dataset.aksi = "selesai";

    const aksi = buat("div", "kartu-aksi");
    aksi.append(tombolLewati, tombolSelesai);

    const dipanggil = buatBlok("Sedang Dipanggil");
    const berikutnya = buatBlok("Berikutnya");
    const tengah = buat("div", "kartu-tengah");
    tengah.append(dipanggil.blok, berikutnya.blok);

    const kosong = buat("p", "keterangan kartu-kosong", "Tidak ada tiket menunggu untuk jenis antrian ini.");

    const tombolPanggil = buat("button", "tombol tombol-kuning", "Panggil Berikutnya");
    tombolPanggil.type = "button";
    tombolPanggil.dataset.kode = jenis.kode;
    tombolPanggil.dataset.aksi = "panggil";

    kartu.append(atas, aksi, tengah, kosong, tombolPanggil);
    kartuAda.set(jenis.kode, {
      menunggu,
      dipanggil: dipanggil.angka,
      berikutnya: berikutnya.angka,
      kosong,
      tombolLewati,
      tombolSelesai,
      tombolPanggil,
    });
    return kartu;
  }

  function render(): void {
    const jenisAktif = bacaJenis().filter((j) => j.aktif);
    const semuaTiket = bacaTiket();

    // jenis baru dari dashboard otomatis muncul, yang nonaktif atau dihapus hilang
    const tanda = jenisAktif.map((j) => `${j.kode}:${j.nama}`).join("|");
    if (tanda !== tandaJenis) {
      tandaJenis = tanda;
      kartuAda.clear();
      wadahKartu.replaceChildren(...jenisAktif.map((j) => buatKartu(j)));
      if (jenisAktif.length === 0) {
        wadahKartu.append(buat("p", "kosong", "Belum ada jenis antrian yang aktif. Aktifkan dulu di dashboard."));
      }
    }

    for (const jenis of jenisAktif) {
      const ref = kartuAda.get(jenis.kode);
      if (!ref) continue;

      const menunggu = semuaTiket.filter((t) => t.kode === jenis.kode && t.status === "menunggu");
      const aktif = semuaTiket.find((t) => t.kode === jenis.kode && t.status === "dipanggil");
      const berikutnya = tiketBerikutnya(semuaTiket, jenis.kode);

      ref.menunggu.textContent = `${menunggu.length} Menunggu`;
      ref.dipanggil.textContent = aktif?.nomor ?? "-";

      // nomor yang sedang dipanggil berubah: angkanya dikasih animasi sebagai tanda tombolnya berhasil
      const nomorLama = dipanggilTerakhir.get(jenis.kode);
      const nomorBaru = aktif?.nomor ?? "";
      dipanggilTerakhir.set(jenis.kode, nomorBaru);
      if (nomorLama !== undefined && nomorBaru !== "" && nomorBaru !== nomorLama) sorot(ref.dipanggil);
      ref.berikutnya.textContent = berikutnya?.nomor ?? "-";
      ref.kosong.hidden = menunggu.length > 0;
      ref.tombolLewati.disabled = !aktif;
      ref.tombolSelesai.disabled = !aktif;
      ref.tombolPanggil.disabled = !berikutnya;
    }
  }

  wadahKartu.addEventListener("click", (event) => {
    const tombol = event.target;
    if (!(tombol instanceof HTMLButtonElement)) return;

    const kode = tombol.dataset.kode;
    if (!kode) return;

    // dibaca ulang dari localStorage tepat sebelum nulis, supaya tiket baru dari tab lain gak ketimpa
    const semuaTiket = bacaTiket();
    const aktif = semuaTiket.find((t) => t.kode === kode && t.status === "dipanggil");

    if (tombol.dataset.aksi === "selesai" || tombol.dataset.aksi === "lewati") {
      if (!aktif) return;
      aktif.status = tombol.dataset.aksi === "lewati" ? "dilewati" : "selesai";
    } else if (tombol.dataset.aksi === "panggil") {
      const berikutnya = tiketBerikutnya(semuaTiket, kode);
      if (!berikutnya) return;
      // satu loket cuma manggil satu orang, yang lagi dipanggil dianggap selesai (sama dengan index.ts)
      if (aktif) aktif.status = "selesai";
      berikutnya.status = "dipanggil";
    }

    simpanTiket(semuaTiket);
    render();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === KUNCI_SESI && !ambilSesi()) {
      location.replace("login.html");
    } else if (event.key === KUNCI_TIKET || event.key === KUNCI_JENIS) {
      render();
    }
  });

  render();
})();
