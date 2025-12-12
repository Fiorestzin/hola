import pandas as pd
import os

file_path = r"C:\Users\adrim\.gemini\antigravity\scratch\finanzas\Viendo como trabajar con bancos.xlsx"
output_path = r"C:\Users\adrim\.gemini\antigravity\scratch\analysis_result.txt"

def analyze_excel(file_path):
    if not os.path.exists(file_path):
        return f"File not found: {file_path}"

    try:
        # Load the Excel file (read only metadata first if possible, but pandas reads all)
        # Using openpyxl directly might be faster for just sheet names, but we want headers.
        # We'll use pandas with specific sheet reading.
        xl = pd.ExcelFile(file_path)
        
        result = []
        result.append(f"Analysis of: {file_path}")
        result.append(f"Sheet Names: {xl.sheet_names}")
        result.append("-" * 30)

        for sheet_name in xl.sheet_names:
            try:
                # Read just a bit to get structure
                df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=5)
                result.append(f"Sheet: {sheet_name}")
                result.append(f"Shape (Approx Columns): {df.shape[1]}")
                result.append(f"Columns: {list(df.columns)}")
                result.append("Sample Data (First 2 rows):")
                result.append(str(df.head(2).to_dict(orient='records')))
                result.append("-" * 30)
            except Exception as e:
                result.append(f"Error reading sheet '{sheet_name}': {e}")
                
        return "\n".join(result)

    except Exception as e:
        return f"Error opening file: {e}"

if __name__ == "__main__":
    report = analyze_excel(file_path)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)
    print("Analysis complete.")
