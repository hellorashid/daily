use chrono::{Local, NaiveDate};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyNotePayload {
    date_key: String,
    file_path: String,
    content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingNoteDatesPayload {
    date_keys: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDailyNotePayload {
    persisted: bool,
}

#[derive(Default)]
pub struct PrimaryFolderState(pub Mutex<Option<PathBuf>>);

fn ensure_folder(folder_path: &str) -> Result<PathBuf, String> {
    let trimmed = folder_path.trim();

    if trimmed.is_empty() {
        return Err("Choose a primary folder before opening today's note.".to_string());
    }

    let path = Path::new(trimmed).to_path_buf();
    fs::create_dir_all(&path)
        .map_err(|error| format!("Couldn't create the primary folder: {error}"))?;

    fs::canonicalize(&path)
        .map_err(|error| format!("Couldn't normalize the primary folder path: {error}"))
}

fn current_primary_folder(state: &State<'_, PrimaryFolderState>) -> Result<PathBuf, String> {
    state
        .0
        .lock()
        .map_err(|_| "Daily lost access to the primary folder state.".to_string())?
        .clone()
        .ok_or_else(|| "Choose a primary folder before opening today's note.".to_string())
}

fn parse_date_key(date_key: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date_key, "%Y-%m-%d")
        .map_err(|_| "Daily couldn't understand that date.".to_string())
}

fn build_payload(folder: &Path, date: NaiveDate) -> Result<DailyNotePayload, String> {
    let date_key = date.format("%Y-%m-%d").to_string();
    let file_path = folder.join(format!("{date_key}.md"));
    let content = if file_path.exists() {
        fs::read_to_string(&file_path)
            .map_err(|error| format!("Couldn't read today's note file: {error}"))?
    } else {
        String::new()
    };

    Ok(DailyNotePayload {
        date_key,
        file_path: file_path.to_string_lossy().into_owned(),
        content,
    })
}

fn build_note_path(folder: &Path, date: NaiveDate) -> PathBuf {
    folder.join(format!("{}.md", date.format("%Y-%m-%d")))
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_primary_folder(
    state: State<'_, PrimaryFolderState>,
    folder_path: Option<String>,
) -> Result<(), String> {
    let mut stored_folder = state
        .0
        .lock()
        .map_err(|_| "Daily couldn't update the primary folder state.".to_string())?;

    *stored_folder = match folder_path {
        Some(folder_path) => Some(ensure_folder(&folder_path)?),
        None => None,
    };

    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_or_create_today_note(state: State<'_, PrimaryFolderState>) -> Result<DailyNotePayload, String> {
    let folder = current_primary_folder(&state)?;
    build_payload(&folder, Local::now().date_naive())
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_or_create_note_for_date(
    state: State<'_, PrimaryFolderState>,
    date_key: String,
) -> Result<DailyNotePayload, String> {
    let folder = current_primary_folder(&state)?;
    let date = parse_date_key(&date_key)?;
    build_payload(&folder, date)
}

#[tauri::command(rename_all = "camelCase")]
pub fn find_existing_note_dates(
    state: State<'_, PrimaryFolderState>,
    start_date_key: String,
    end_date_key: String,
) -> Result<ExistingNoteDatesPayload, String> {
    let folder = current_primary_folder(&state)?;
    let start_date = parse_date_key(&start_date_key)?;
    let end_date = parse_date_key(&end_date_key)?;

    if end_date < start_date {
        return Err("Daily couldn't understand that calendar range.".to_string());
    }

    let mut date_keys = Vec::new();
    let mut current = start_date;

    while current <= end_date {
        let note_path = build_note_path(&folder, current);

        if note_path.exists() {
            date_keys.push(current.format("%Y-%m-%d").to_string());
        }

        current = current
            .succ_opt()
            .ok_or_else(|| "Daily couldn't finish scanning that month.".to_string())?;
    }

    Ok(ExistingNoteDatesPayload { date_keys })
}

#[tauri::command(rename_all = "camelCase")]
pub fn save_daily_note(
    state: State<'_, PrimaryFolderState>,
    date_key: String,
    content: String,
) -> Result<SaveDailyNotePayload, String> {
    let folder = current_primary_folder(&state)?;
    let date = parse_date_key(&date_key)?;
    let note_path = build_note_path(&folder, date);

    if content.trim().is_empty() && !note_path.exists() {
        return Ok(SaveDailyNotePayload { persisted: false });
    }

    if let Some(parent) = note_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Couldn't prepare today's note folder: {error}"))?;
    }

    fs::write(note_path, content)
        .map_err(|error| format!("Couldn't save today's note: {error}"))?;

    Ok(SaveDailyNotePayload { persisted: true })
}

#[tauri::command(rename_all = "camelCase")]
pub fn open_in_finder(state: State<'_, PrimaryFolderState>) -> Result<(), String> {
    let folder = current_primary_folder(&state)?;

    let status = Command::new("open")
        .arg(folder)
        .status()
        .map_err(|error| format!("Couldn't open Finder: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("Finder didn't open that folder.".to_string())
    }
}
