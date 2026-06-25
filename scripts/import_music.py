#!/usr/bin/env python3

import urllib.request
import urllib.parse
import re
import json
import struct
import sys
import os
import hashlib
import shutil

EXISTING_SONGS_FROM_STDIN = []
try:
    if not sys.stdin.isatty():
        stdin_data = sys.stdin.read().strip()
        if stdin_data:
            EXISTING_SONGS_FROM_STDIN = json.loads(stdin_data)
except Exception as e:
    sys.stderr.write(f"[*] Warning reading stdin: {e}\n")

try:
    import mutagen
except ImportError:
    mutagen = None


def parse_flac_bytes(data):
    if len(data) < 42 or data[:4] != b'fLaC':
        return None
    try:
        info_bytes = data[18:26]
        val = struct.unpack('>Q', info_bytes)[0]
        sample_rate = (val >> 44) & 0xFFFFF
        channels = ((val >> 41) & 0x07) + 1
        bps = ((val >> 36) & 0x1F) + 1
        total_samples = val & 0xFFFFFFFFF
        duration = total_samples / sample_rate if sample_rate > 0 else 0
        return {
            "sample_rate": sample_rate,
            "channels": channels,
            "bps": bps,
            "duration": round(duration, 2)
        }
    except Exception:
        return None


def get_flac_info(file_id):
    url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Range': 'bytes=0-199'
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as response:
            content_range = response.headers.get('Content-Range', '')
            file_size = None
            if content_range and '/' in content_range:
                try:
                    file_size = int(content_range.split('/')[-1])
                except:
                    pass
            data = response.read()
            info = parse_flac_bytes(data)
            if info and file_size:
                info['file_size'] = file_size
            return info
    except Exception:
        return None


def parse_wav_bytes(data):
    if len(data) < 44 or data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        return None
    try:
        idx = 12
        while idx < len(data) - 8:
            chunk_id = data[idx:idx+4]
            chunk_size = struct.unpack('<I', data[idx+4:idx+8])[0]
            if chunk_id == b'fmt ':
                fmt_data = data[idx+8 : idx+8+chunk_size]
                channels = struct.unpack('<H', fmt_data[2:4])[0]
                sample_rate = struct.unpack('<I', fmt_data[4:8])[0]
                bps = struct.unpack('<H', fmt_data[14:16])[0]
                riff_size = struct.unpack('<I', data[4:8])[0]
                file_size = riff_size + 8
                bytes_per_sec = sample_rate * channels * (bps / 8)
                duration = (file_size - 44) / bytes_per_sec if bytes_per_sec > 0 else 0
                return {
                    "channels": channels,
                    "sample_rate": sample_rate,
                    "bps": bps,
                    "duration": round(duration, 2)
                }
            idx += 8 + chunk_size
    except Exception:
        pass
    return None


def get_wav_info(file_id):
    url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Range': 'bytes=0-199'
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as response:
            content_range = response.headers.get('Content-Range', '')
            file_size = None
            if content_range and '/' in content_range:
                try:
                    file_size = int(content_range.split('/')[-1])
                except:
                    pass
            data = response.read()
            info = parse_wav_bytes(data)
            if info and file_size:
                info['file_size'] = file_size
            return info
    except Exception:
        return None


def format_bitrate(kbps):
    try:
        return f"{int(round(kbps)):,}"
    except Exception:
        return "1,411"


def parse_filename(filename):
    name_without_ext, ext = os.path.splitext(filename)
    ext = ext.replace('.', '').upper()
    artist = "Unknown Artist"
    title = name_without_ext
    album = "Unknown Album"
    if " - " in name_without_ext:
        parts = name_without_ext.split(" - ", 1)
        artist = parts[0].strip()
        rest = parts[1].strip()
        album_match = re.search(r'\((?:From\s+[_“"])(.*?)(?:[_”"])\)', rest, re.IGNORECASE)
        if album_match:
            album = album_match.group(1).strip()
            title = rest.replace(album_match.group(0), "").strip()
        else:
            title = rest
    title = re.sub(r'\s+', ' ', title).strip()
    if not artist:
        artist = "Unknown Artist"
    if not album:
        album = "Unknown Album"
    return artist, title, album, ext


DEFAULT_COVERS = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1539625319138-1e028b1aa25d?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1526478806334-5fa488f7f9ec?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1484755560695-a4ec7489fc85?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&auto=format&fit=crop&q=60",
    "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=500&auto=format&fit=crop&q=60"
]

ORIGINAL_METADATA = {}


def get_song_id(title, default_id):
    title_lower = title.lower()
    if "kuchi kuchi" in title_lower:
        return "1"
    if "andha arabi" in title_lower:
        return "2"
    if "uyire" in title_lower:
        return "3"
    return default_id


def get_unique_cover(title):
    val_hash = sum(ord(c) for c in title) % len(DEFAULT_COVERS)
    return DEFAULT_COVERS[val_hash]


def find_local_folder_cover(audio_file_path, dest_cover_dir, resolved_id):
    parent_dir = os.path.dirname(audio_file_path)
    if not parent_dir or not os.path.exists(parent_dir):
        return None
    
    # Common image names
    image_names = ['folder', 'cover', 'album', 'front']
    image_exts = ['.jpg', '.jpeg', '.png']
    
    # First search for exact name matches
    for name in image_names:
        for ext in image_exts:
            for file_in_dir in os.listdir(parent_dir):
                if file_in_dir.lower() == f"{name}{ext}":
                    img_path = os.path.join(parent_dir, file_in_dir)
                    dest_ext = ext if ext != '.jpeg' else '.jpg'
                    dest_filename = f"{resolved_id}{dest_ext}"
                    dest_path = os.path.join(dest_cover_dir, dest_filename)
                    try:
                        shutil.copy2(img_path, dest_path)
                        return f"/covers/{dest_filename}"
                    except Exception as e:
                        print(f"[!] Error copying folder cover {img_path}: {e}")
                        
    # Next, search for any image in the parent directory if it's the only one
    all_images = [f for f in os.listdir(parent_dir) if any(f.lower().endswith(ext) for ext in image_exts)]
    if len(all_images) == 1:
        img_path = os.path.join(parent_dir, all_images[0])
        _, ext = os.path.splitext(all_images[0].lower())
        dest_filename = f"{resolved_id}{ext}"
        dest_path = os.path.join(dest_cover_dir, dest_filename)
        try:
            shutil.copy2(img_path, dest_path)
            return f"/covers/{dest_filename}"
        except Exception as e:
            print(f"[!] Error copying single image cover {img_path}: {e}")
            
    return None


def print_cover_art_stats(songs):
    embedded = 0
    folder = 0
    fallback = 0
    for s in songs:
        src = s.get("coverSource", "")
        if src == "embedded":
            embedded += 1
        elif src == "folder":
            folder += 1
        elif src == "fallback":
            fallback += 1
        else:
            # Guess based on cover path
            cover = s.get("cover", "")
            if cover.startswith("/covers/"):
                embedded += 1
            else:
                fallback += 1
                
    print("\n--- Cover Art Statistics ---")
    print(f" - Embedded Cover Art: {embedded}")
    print(f" - Folder Cover Art: {folder}")
    print(f" - Fallback (Initials/Gradients): {fallback}")


def extract_embedded_cover(audio_file_path, dest_cover_dir, song_id):
    if mutagen is None:
        return None
    try:
        audio = mutagen.File(audio_file_path)
        if audio is None:
            return None
        if hasattr(audio, 'pictures') and audio.pictures:
            for pic in audio.pictures:
                if pic.type == 3 or len(audio.pictures) == 1:
                    ext = ".jpg" if "jpeg" in pic.mime.lower() else ".png"
                    filename = f"{song_id}{ext}"
                    dest_path = os.path.join(dest_cover_dir, filename)
                    with open(dest_path, "wb") as f:
                        f.write(pic.data)
                    return f"/covers/{filename}"
        if hasattr(audio, 'tags') and audio.tags:
            for tag_name in audio.tags.keys():
                if tag_name.startswith("APIC"):
                    pic = audio.tags[tag_name]
                    if hasattr(pic, 'mime') and hasattr(pic, 'data'):
                        ext = ".jpg" if "jpeg" in pic.mime.lower() else ".png"
                        filename = f"{song_id}{ext}"
                        dest_path = os.path.join(dest_cover_dir, filename)
                        with open(dest_path, "wb") as f:
                            f.write(pic.data)
                        return f"/covers/{filename}"
        if 'covr' in audio:
            covr = audio['covr']
            if covr:
                data = covr[0]
                ext = ".jpg"
                if data.startswith(b'\x89PNG\r\n\x1a\n'):
                    ext = ".png"
                filename = f"{song_id}{ext}"
                dest_path = os.path.join(dest_cover_dir, filename)
                with open(dest_path, "wb") as f:
                    f.write(data)
                return f"/covers/{filename}"
        if 'metadata_block_picture' in audio:
            pictures = audio['metadata_block_picture']
            for pic_b64 in pictures:
                try:
                    import base64
                    from mutagen.flac import Picture
                    pic_data = base64.b64decode(pic_b64)
                    pic = Picture(pic_data)
                    ext = ".jpg" if "jpeg" in pic.mime.lower() else ".png"
                    filename = f"{song_id}{ext}"
                    dest_path = os.path.join(dest_cover_dir, filename)
                    with open(dest_path, "wb") as f:
                        f.write(pic.data)
                    return f"/covers/{filename}"
                except Exception as e:
                    print(f"[!] Error parsing Ogg picture: {e}")
    except Exception as e:
        print(f"[!] Error extracting cover from {audio_file_path}: {e}")
    return None


def clean_database(songs):
    if not songs:
        return []
    seen_ids = set()
    seen_combos = set()
    deduped = []
    for song in songs:
        orig_id = song["id"]
        title = song["title"]
        resolved_id = get_song_id(title, orig_id)
        song["id"] = resolved_id
        if resolved_id in ORIGINAL_METADATA:
            meta = ORIGINAL_METADATA[resolved_id]
            song["title"] = meta["title"]
            song["artist"] = meta["artist"]
            song["album"] = meta["album"]
            if "cover" not in song or not song["cover"]:
                song["cover"] = meta["cover"]
        title_norm = title.lower().strip()
        title_norm = re.sub(r'\(from.*?\)', '', title_norm).strip()
        title_norm = re.sub(r'\(wind\)', '', title_norm).strip()
        artist_norm = song.get("artist", "Unknown Artist").lower().strip()
        album_norm = song.get("album", "Unknown Album").lower().strip()
        combo = (title_norm, artist_norm, album_norm)
        if resolved_id in seen_ids or combo in seen_combos:
            continue
        seen_ids.add(resolved_id)
        seen_combos.add(combo)
        deduped.append(song)
    return deduped


def save_database(songs, songs_json_path=None):
    seen_ids = set()
    seen_combos = set()
    final_songs = []
    for song in songs:
        orig_id = song["id"]
        title = song["title"]
        resolved_id = get_song_id(title, orig_id)
        song["id"] = resolved_id
        if resolved_id in ORIGINAL_METADATA:
            meta = ORIGINAL_METADATA[resolved_id]
            song["title"] = meta["title"]
            song["artist"] = meta["artist"]
            song["album"] = meta["album"]
        title_norm = title.lower().strip()
        title_norm = re.sub(r'\(from.*?\)', '', title_norm).strip()
        artist_norm = song.get("artist", "Unknown Artist").lower().strip()
        album_norm = song.get("album", "Unknown Album").lower().strip()
        combo = (title_norm, artist_norm, album_norm)
        if resolved_id in seen_ids or combo in seen_combos:
            continue
        seen_ids.add(resolved_id)
        seen_combos.add(combo)
        final_songs.append(song)
    try:
        # Instead of writing a file, print to stdout between separators for Node to pick up
        print("===JSON_START===")
        print(json.dumps(final_songs))
        print("===JSON_END===")
        print(f"[+] Outputted {len(final_songs)} unique tracks to stdout JSON stream")
    except Exception as e:
        print(f"[!] Error serializing songs to stdout: {e}")


def extract_gdrive_metadata_and_cover(file_id, filename, format_name):
    temp_dir = os.path.join(os.path.dirname(__file__), "temp_import")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, filename.replace('/', '_'))
    url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
    artist, title, album, _ = parse_filename(filename)
    genre = "Unknown Genre"
    duration = 180.0
    details = f"{format_name} Stream"
    cover_url = None
    print(f"[*] Downloading {filename} from Google Drive to extract metadata/artwork...")
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=45) as response, open(temp_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        if mutagen is not None:
            try:
                easy_audio = mutagen.File(temp_path, easy=True)
                if easy_audio:
                    title = easy_audio.get("title", [title])[0]
                    artist = easy_audio.get("artist", [artist])[0]
                    album = easy_audio.get("album", [album])[0]
                    genre = easy_audio.get("genre", [genre])[0]
            except Exception as e:
                print(f"[!] Error parsing easy tags: {e}")
        covers_dir = os.path.join(os.path.dirname(__file__), "..", "data", "covers")
        os.makedirs(covers_dir, exist_ok=True)
        cover_url = extract_embedded_cover(temp_path, covers_dir, file_id)
        try:
            audio = mutagen.File(temp_path)
            if audio and hasattr(audio, 'info'):
                duration = getattr(audio.info, 'length', duration)
                sample_rate = getattr(audio.info, 'sample_rate', None)
                bps = getattr(audio.info, 'bits_per_sample', None)
                channels = getattr(audio.info, 'channels', 2)
                bitrate = getattr(audio.info, 'bitrate', None)
                if format_name == 'FLAC':
                    if bps and sample_rate:
                        file_size = os.path.getsize(temp_path)
                        kbps = (file_size * 8) / (duration * 1000) if duration > 0 else (bitrate / 1000 if bitrate else None)
                        if kbps:
                            details = f"FLAC • {bps}-bit • {round(sample_rate/1000, 1)} kHz • {format_bitrate(kbps)} kbps"
                        else:
                            details = f"FLAC • {bps}-bit • {round(sample_rate/1000, 1)} kHz"
                elif format_name == 'WAV':
                    if bps and sample_rate:
                        kbps = (sample_rate * channels * bps) / 1000
                        details = f"WAV • {bps}-bit • {round(sample_rate/1000, 1)} kHz • {format_bitrate(kbps)} kbps"
                elif format_name == 'MP3':
                    kbps = bitrate / 1000 if bitrate else 320
                    details = f"MP3 • {format_bitrate(kbps)} kbps"
                elif format_name in ('AAC', 'M4A'):
                    kbps = bitrate / 1000 if bitrate else 256
                    details = f"AAC • {format_bitrate(kbps)} kbps"
                elif format_name == 'OGG':
                    details = "OGG • Vorbis"
        except Exception as e:
            print(f"[!] Error parsing audio properties: {e}")
    except Exception as e:
        print(f"[!] Failed to download and extract metadata: {e}")
        raise e
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        try:
            os.rmdir(temp_dir)
        except:
            pass
    if not title:
        title = filename
    if not artist:
        artist = "Unknown Artist"
    if not album:
        album = "Unknown Album"
    if not genre:
        genre = "Unknown Genre"
    cover_source = "embedded" if cover_url else "fallback"
    if not cover_url:
        cover_url = get_unique_cover(title)
    return title, artist, album, genre, duration, details, cover_url, cover_source


# ==================== NEW: Robust listing for large folders ====================

def extract_folder_id(url):
    """Extract Google Drive folder ID from various URL formats."""
    if not url:
        return None
    patterns = [
        r'/folders/([a-zA-Z0-9_-]{10,})',
        r'[?&]id=([a-zA-Z0-9_-]{10,})',
        r'/drive/u/\d+/folders/([a-zA-Z0-9_-]{10,})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Last resort: find any long ID-like string
    candidates = re.findall(r'([a-zA-Z0-9_-]{25,})', url)
    for c in candidates:
        if not c.startswith(('http', 'www')) and len(c) >= 25:
            return c
    return None


def list_audio_files_via_api(folder_id, api_key):
    """
    List ALL audio files in a public/shared Google Drive folder using Drive API v3.
    Requires a free Google Cloud API key (no OAuth needed for public folders).
    This solves the "only first 50 files" problem completely.
    """
    if not folder_id or not api_key:
        return {}
    all_audio = {}
    page_token = None
    base = "https://www.googleapis.com/drive/v3/files"
    audio_exts = ('.flac', '.mp3', '.wav', '.m4a', '.alac', '.aac', '.ogg')
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; MusicImportScript/2.0)'}

    while True:
        params = {
            'q': f"'{folder_id}' in parents and trashed=false",
            'fields': 'nextPageToken,files(id,name,mimeType)',
            'pageSize': 1000,
            'key': api_key
        }
        if page_token:
            params['pageToken'] = page_token
        qs = urllib.parse.urlencode(params)
        url = f"{base}?{qs}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=25) as resp:
                if resp.status != 200:
                    print(f"[!] Drive API HTTP {resp.status}")
                    break
                data = json.loads(resp.read().decode('utf-8', errors='ignore'))
            items = data.get('files', [])
            for item in items:
                name = item.get('name', '').strip()
                fid = item.get('id', '')
                mime = item.get('mimeType', '')
                if not name or not fid:
                    continue
                lname = name.lower()
                is_audio = (any(lname.endswith(ext) for ext in audio_exts) or
                            mime.startswith('audio/') or 'audio' in mime.lower())
                if is_audio:
                    all_audio[name] = fid
            print(f"[*] API batch: {len(items)} items processed → total audio files: {len(all_audio)}")
            page_token = data.get('nextPageToken')
            if not page_token:
                break
        except urllib.error.HTTPError as e:
            print(f"[!] Drive API HTTPError: {e.code} {e.reason}")
            if e.code in (403, 400):
                print("    → Check that GOOGLE_DRIVE_API_KEY is valid and folder is publicly shared ('Anyone with the link').")
            break
        except Exception as e:
            print(f"[!] Drive API error: {e}")
            break
    print(f"[+] Drive API listing complete. Discovered {len(all_audio)} audio tracks.")
    return all_audio


def import_gdrive_folder(folder_url, env=None):
    if env is None:
        env = load_env()

    print(f"[*] Fetching Google Drive folder: {folder_url}")

    folder_id = extract_folder_id(folder_url)
    if not folder_id:
        print("[!] Could not extract folder ID from the provided URL.")
        print("    Example valid URL: https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz123456")
        return

    api_key = env.get("GOOGLE_DRIVE_API_KEY", "").strip() if env else ""

    if api_key:
        print(f"[*] Using Google Drive API v3 with API key (best for 100+ files)")
        extracted_items = list_audio_files_via_api(folder_id, api_key)
    else:
        print("[!] GOOGLE_DRIVE_API_KEY not found in environment or .env file.")
        print("    Falling back to HTML scraping (usually limited to first ~50 files on large folders).")
        print("    >>> RECOMMENDATION: Add a free API key to .env for complete results (see bottom of this file). <<<")
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        }
        try:
            req = urllib.request.Request(folder_url, headers=headers)
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8')
        except Exception as e:
            print(f"[!] Error downloading folder page: {e}")
            return

        ext_pattern = r'"([^"]+\.(?:flac|mp3|wav|m4a|alac|aac|ogg))"'
        matches = list(re.finditer(ext_pattern, html, re.IGNORECASE))
        extracted_items = {}
        for m in matches:
            filename = m.group(1)
            pos = m.start()
            window = html[max(0, pos-300):min(len(html), pos+300)]
            ids = re.findall(r'"([a-zA-Z0-9_\-]{25,})"', window)
            valid_ids = [i for i in ids if i not in filename and not i.startswith('audio/')]
            if valid_ids:
                extracted_items[filename] = valid_ids[0]

        if not extracted_items:
            print("[!] No audio files found via scraping. The folder may require login or the structure changed.")
            return
        print(f"[+] Discovered {len(extracted_items)} audio tracks via scraping (may be incomplete for large folders).")

    if not extracted_items:
        print("[!] No audio files found. Nothing to import.")
        return

    existing_songs = clean_database(EXISTING_SONGS_FROM_STDIN)

    # Calculate scanned ids for deletion synchronization
    scanned_ids = set()
    for filename, file_id in extracted_items.items():
        artist, title, album, format_name = parse_filename(filename)
        resolved_id = get_song_id(title, file_id)
        scanned_ids.add(resolved_id)

    # Synchronize deletions by filtering database selectively (preserve local files!)
    existing_songs = [
        s for s in existing_songs
        if ("drive.usercontent.google.com" not in s["url"]) or s["id"] in scanned_ids
    ]
    existing_ids = {s["id"] for s in existing_songs}

    scanned_files = []
    skipped_files = []
    added_count = 0
    updated_count = 0

    for idx, (filename, file_id) in enumerate(extracted_items.items(), 1):
        artist, title, album, format_name = parse_filename(filename)
        resolved_id = get_song_id(title, file_id)
        stream_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download"

        if resolved_id in existing_ids:
            for s in existing_songs:
                if s["id"] == resolved_id:
                    s["url"] = stream_url
                    break
            updated_count += 1
            scanned_files.append((filename, "Updated stream URL (Already indexed)"))
            continue

        # New song
        try:
            title, artist, album, genre, duration, details, cover_url, cover_source = extract_gdrive_metadata_and_cover(file_id, filename, format_name)
            song_entry = {
                "id": resolved_id,
                "title": title,
                "artist": artist,
                "album": album,
                "genre": genre,
                "url": stream_url,
                "cover": cover_url,
                "coverSource": cover_source,
                "format": format_name,
                "details": details,
                "duration": duration
            }
            existing_songs.append(song_entry)
            existing_ids.add(resolved_id)
            added_count += 1
            scanned_files.append((filename, "Successfully scanned and indexed new track"))
        except Exception as e:
            skipped_files.append((resolved_id, filename, "gdrive", f"Parsing failure: {e}"))

    save_database(existing_songs)

    # Print Diagnostics Report
    print("\n" + "="*60)
    print("GOOGLE DRIVE SYNC DIAGNOSTIC REPORT")
    print("="*60)
    print(f"Total files discovered: {len(extracted_items)}")
    print(f"Total new tracks added: {added_count}")
    print(f"Total existing tracks updated: {updated_count}")
    print(f"Total tracks skipped/failed: {len(skipped_files)}")
    print_cover_art_stats(existing_songs)
    if scanned_files:
        print("\n--- Scanned / Indexed Files ---")
        for fn, status in scanned_files:
            print(f" - {fn}: {status}")
    if skipped_files:
        print("\n--- Skipped Files / Tracks ---")
        print("Track ID | File Name | Source | Skip Reason")
        print("---------|-----------|--------|------------")
        for tid, fn, src, reason in skipped_files:
            print(f"{tid} | {fn} | {src} | {reason}")
    print("="*60 + "\n")


def import_local_folder(local_dir):
    print(f"[*] Scanning local music directory: {local_dir}")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"[*] Also scanning project root directory: {project_root}")
    dest_dir = os.path.join(os.path.dirname(__file__), "..", "data", "tracks")
    os.makedirs(dest_dir, exist_ok=True)
    existing_songs = clean_database(EXISTING_SONGS_FROM_STDIN)
    extensions = ('.flac', '.mp3', '.wav', '.m4a', '.alac', '.aac', '.ogg')
    discovered_files = []
    skipped_files = []
    scanned_files = []

    def scan_directory_files(d, source_label):
        if not os.path.exists(d):
            skipped_files.append(("N/A", d, source_label, "Directory does not exist"))
            return
        for filename in os.listdir(d):
            full_path = os.path.join(d, filename)
            if os.path.isdir(full_path):
                if filename in ('node_modules', '.git', '.gemini', 'venv', 'public', 'data', 'scripts', 'src', 'covers', 'tracks'):
                    continue
                continue
            if not filename.lower().endswith(extensions):
                skipped_files.append(("N/A", filename, source_label, "Unsupported file extension"))
                continue
            discovered_files.append((filename, full_path, source_label))

    if local_dir:
        scan_directory_files(local_dir, "LOCAL_DIR")
    scan_directory_files(project_root, "PROJECT_ROOT")

    seen_paths = set()
    deduped_files = []
    for filename, full_path, source_label in discovered_files:
        real_p = os.path.realpath(full_path)
        if real_p in seen_paths:
            skipped_files.append(("N/A", filename, source_label, "Duplicate path (already scanned)"))
            continue
        seen_paths.add(real_p)
        deduped_files.append((filename, full_path, source_label))

    print(f"[+] Found {len(deduped_files)} unique audio files to sync locally.")

    scanned_ids = set()
    for filename, full_path, _ in deduped_files:
        artist_tag, title_tag, album_tag, format_name = parse_filename(filename)
        title = title_tag
        if mutagen is not None:
            try:
                easy_audio = mutagen.File(full_path, easy=True)
                if easy_audio and easy_audio.get("title"):
                    title = easy_audio.get("title")[0]
            except:
                pass
        file_hash = hashlib.md5(filename.encode('utf-8')).hexdigest()
        resolved_id = get_song_id(title, file_hash)
        scanned_ids.add(resolved_id)

    existing_songs = [
        s for s in existing_songs
        if ("drive.usercontent.google.com" in s["url"]) or s["id"] in scanned_ids
    ]
    existing_ids = {s["id"] for s in existing_songs}

    added_count = 0
    updated_count = 0

    for filename, full_path, source_label in deduped_files:
        artist, title, album, format_name = parse_filename(filename)
        genre = "Unknown Genre"
        dest_path = os.path.join(dest_dir, filename)
        if not os.path.exists(dest_path):
            try:
                shutil.copy2(full_path, dest_path)
            except Exception as e:
                skipped_files.append(("N/A", filename, source_label, f"Failed to copy to data/tracks: {e}"))
                continue
        file_hash = hashlib.md5(filename.encode('utf-8')).hexdigest()
        if mutagen is not None:
            try:
                easy_audio = mutagen.File(dest_path, easy=True)
                if easy_audio:
                    title = easy_audio.get("title", [title])[0]
                    artist = easy_audio.get("artist", [artist])[0]
                    album = easy_audio.get("album", [album])[0]
                    genre = easy_audio.get("genre", [genre])[0]
            except Exception as e:
                print(f"[!] Error parsing easy tags: {e}")
        if not title:
            title = filename
        if not artist:
            artist = "Unknown Artist"
        if not album:
            album = "Unknown Album"
        if not genre:
            genre = "Unknown Genre"
        resolved_id = get_song_id(title, file_hash)
        covers_dir = os.path.join(os.path.dirname(__file__), "..", "data", "covers")
        os.makedirs(covers_dir, exist_ok=True)
        cover_url = extract_embedded_cover(dest_path, covers_dir, resolved_id)
        cover_source = "embedded" if cover_url else "fallback"
        if not cover_url:
            cover_url = find_local_folder_cover(dest_path, covers_dir, resolved_id)
            if cover_url:
                cover_source = "folder"
            else:
                cover_url = get_unique_cover(title)
        duration = 180.0
        details = f"{format_name} File"
        if mutagen is not None:
            try:
                audio = mutagen.File(dest_path)
                if audio and hasattr(audio, 'info'):
                    duration = getattr(audio.info, 'length', duration)
                    sample_rate = getattr(audio.info, 'sample_rate', None)
                    bps = getattr(audio.info, 'bits_per_sample', None)
                    channels = getattr(audio.info, 'channels', 2)
                    bitrate = getattr(audio.info, 'bitrate', None)
                    if format_name == 'FLAC':
                        if bps and sample_rate:
                            file_size = os.path.getsize(dest_path)
                            kbps = (file_size * 8) / (duration * 1000) if duration > 0 else (bitrate / 1000 if bitrate else None)
                            if kbps:
                                details = f"FLAC • {bps}-bit • {round(sample_rate/1000, 1)} kHz • {format_bitrate(kbps)} kbps"
                            else:
                                details = f"FLAC • {bps}-bit • {round(sample_rate/1000, 1)} kHz"
                    elif format_name == 'WAV':
                        if bps and sample_rate:
                            kbps = (sample_rate * channels * bps) / 1000
                            details = f"WAV • {bps}-bit • {round(sample_rate/1000, 1)} kHz • {format_bitrate(kbps)} kbps"
                    elif format_name == 'MP3':
                        kbps = bitrate / 1000 if bitrate else 320
                        details = f"MP3 • {format_bitrate(kbps)} kbps"
                    elif format_name in ('AAC', 'M4A'):
                        kbps = bitrate / 1000 if bitrate else 256
                        details = f"AAC • {format_bitrate(kbps)} kbps"
                    elif format_name == 'OGG':
                        details = "OGG • Vorbis"
            except Exception as e:
                print(f"[!] Error reading audio info for details: {e}")
        stream_url = f"/tracks/{filename}"
        if resolved_id in existing_ids:
            for s in existing_songs:
                if s["id"] == resolved_id:
                    s["url"] = stream_url
                    s["cover"] = cover_url
                    s["coverSource"] = cover_source
                    s["details"] = details
                    s["duration"] = duration
                    s["title"] = title
                    s["artist"] = artist
                    s["album"] = album
                    s["genre"] = genre
                    break
            updated_count += 1
            scanned_files.append((filename, f"Updated metadata/details ({source_label})"))
            continue
        song_entry = {
            "id": resolved_id,
            "title": title,
            "artist": artist,
            "album": album,
            "genre": genre,
            "url": stream_url,
            "cover": cover_url,
            "coverSource": cover_source,
            "format": format_name,
            "details": details,
            "duration": duration
        }
        existing_songs.append(song_entry)
        existing_ids.add(resolved_id)
        added_count += 1
        scanned_files.append((filename, f"Successfully imported new local track ({source_label})"))

    save_database(existing_songs)

    print("\n" + "="*60)
    print("LOCAL MUSIC SYNC DIAGNOSTIC REPORT")
    print("="*60)
    print(f"Total files discovered: {len(deduped_files)}")
    print(f"Total new tracks added: {added_count}")
    print(f"Total existing tracks updated: {updated_count}")
    print(f"Total tracks skipped/failed: {len(skipped_files)}")
    print_cover_art_stats(existing_songs)
    if scanned_files:
        print("\n--- Scanned / Indexed Files ---")
        for fn, status in scanned_files:
            print(f" - {fn}: {status}")
    if skipped_files:
        print("\n--- Skipped Files / Tracks ---")
        print("Track ID | File Name | Source | Skip Reason")
        print("---------|-----------|--------|------------")
        for tid, fn, src, reason in skipped_files:
            print(f"{tid} | {fn} | {src} | {reason}")
    print("="*60 + "\n")


def load_env():
    env_vars = dict(os.environ)
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_path = os.path.abspath(env_path)
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip()
                        if k not in env_vars or not env_vars[k]:
                            env_vars[k] = v
    return env_vars
