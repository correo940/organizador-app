from PIL import Image
import sys

def add_padding(input_path, output_path, padding_percent=0.25):
    try:
        img = Image.open(input_path).convert("RGBA")
        width, height = img.size
        
        # Calculate new size based on padding (inverse logic: original is 1-padding of new)
        # Actually easier: Make canvas bigger
        # Target content size = 100% - (padding * 2)
        # Let's say we want the content to be 70% of the canvas.
        # factor = 1 / 0.7 = 1.42
        
        new_width = int(width * 1.4)
        new_height = int(height * 1.4)
        
        new_img = Image.new("RGBA", (new_width, new_height), (0, 0, 0, 0))
        
        # Center the image
        offset_x = (new_width - width) // 2
        offset_y = (new_height - height) // 2
        
        new_img.paste(img, (offset_x, offset_y), img)
        
        # Resize back to original size if needed? 
        # Actually capacitor-assets handles resizing from high-res source.
        # Just saving the padded version is fine.
        new_img.save(output_path, "PNG")
        print(f"Successfully added padding to {input_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    add_padding("assets/icon.png", "assets/icon.png")
