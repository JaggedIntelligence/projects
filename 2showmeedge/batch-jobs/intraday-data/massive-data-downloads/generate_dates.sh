#!/bin/sh

# Set up your rclone configuration
rclone config create s3massive s3 env_auth=false access_key_id=e754da0f-31d9-4e10-82c3-d76094190342 secret_access_key=lZFbR15FKx1HOiNqlVUbiagM0hPOog5K endpoint=https://files.massive.com

start_date="${1:-2021-08-01}"
end_date="${2:-$(date +%Y-%m-%d)}"

if TZ=UTC date -j -f "%Y-%m-%d" "$start_date" "+%s" >/dev/null 2>&1; then
    # macOS / BSD date
    current_epoch=$(TZ=UTC date -j -f "%Y-%m-%d" "$start_date" "+%s") || exit 1
    end_epoch=$(TZ=UTC date -j -f "%Y-%m-%d" "$end_date" "+%s") || exit 1

    format_date() {
        TZ=UTC date -r "$1" "+%Y/%m/%Y-%m-%d"
    }
else
    # GNU date (Linux)
    current_epoch=$(TZ=UTC date -d "$start_date" "+%s") || exit 1
    end_epoch=$(TZ=UTC date -d "$end_date" "+%s") || exit 1

    format_date() {
        TZ=UTC date -d "@$1" "+%Y/%m/%Y-%m-%d"
    }
fi

if [ "$current_epoch" -gt "$end_epoch" ]; then
    echo "Start date must not be later than end date." >&2
    exit 1
fi

while [ "$current_epoch" -le "$end_epoch" ]; do
    formatted_date=$(format_date "$current_epoch") || exit 1
    final_date=$(printf '%s' "$formatted_date" | tr -d '\r\n')
    echo "$final_date"
    next_epoch=$((current_epoch + 86400))

    if [ "$next_epoch" -le "$current_epoch" ]; then
        echo "Date failed to advance; stopping." >&2
        exit 1
    fi

    current_epoch=$next_epoch
done