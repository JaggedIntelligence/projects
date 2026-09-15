#!/usr/bin/env python3
"""Extracts metadata and chapters from a YouTube URL and saves it as a JSON file."""

import json
import yt_dlp

def extract_youtube_metadata(url: str, output_filename: str = "video_metadata.json"):
    """
    Extracts metadata and chapters from a YouTube URL and saves it as a JSON file.
    """
    # Configure yt-dlp to extract info without downloading media files
    ydl_opts = {
        'extract_flat': False, # Extract full metadata
        'skip_download': True, # Do not download video or audio files
        'quiet': True          # Suppress standard terminal output
    }

    print(f"Fetching metadata for: {url}...")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            # Extract video info dictionary
            info_dict = ydl.extract_info(url, download=False)
            
            # Key metadata extracted
            metadata = {
                "id": info_dict.get("id"),
                "title": info_dict.get("title"),
                "uploader": info_dict.get("uploader"),
                "channel_url": info_dict.get("channel_url"),
                "upload_date": info_dict.get("upload_date"),
                "duration_seconds": info_dict.get("duration"),
                "view_count": info_dict.get("view_count"),
                "like_count": info_dict.get("like_count"),
                "description": info_dict.get("description"),
                "webpage_url": info_dict.get("webpage_url"),
                # Extract chapters (list of dicts containing start_time, end_time, title)
                "chapters": info_dict.get("chapters", [])
            }

            # Write formatted JSON output
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=4, ensure_ascii=False)

            print(f"Successfully saved metadata to '{output_filename}'")
            return metadata

        except Exception as e:
            print(f"An error occurred: {e}")
            return None

if __name__ == "__main__":
    youtube_url = "https://www.youtube.com/watch?v=NuvaglYGWj4"
    extract_youtube_metadata(youtube_url, output_filename="bloomberg_metadata.json")