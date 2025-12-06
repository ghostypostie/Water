from PIL import Image, ImageDraw

# Create bg.bmp (164x314) - Vertical gradient black to dark purple
bg = Image.new('RGB', (164, 314))
draw_bg = ImageDraw.Draw(bg)

for y in range(314):
    # Gradient from black (0,0,0) to dark purple (32,0,40)
    r = int((32 / 314) * y)
    g = 0
    b = int((40 / 314) * y)
    draw_bg.line([(0, y), (164, y)], fill=(r, g, b))

# Add pink glow on edges
for x in range(10):
    alpha = int(255 * (1 - x/10))
    for y in range(314):
        # Left edge
        current = bg.getpixel((x, y))
        new_r = min(255, current[0] + int(255 * (1 - x/10) * 0.3))
        new_b = min(255, current[2] + int(147 * (1 - x/10) * 0.3))
        bg.putpixel((x, y), (new_r, current[1], new_b))
        
        # Right edge
        current = bg.getpixel((163-x, y))
        new_r = min(255, current[0] + int(255 * (1 - x/10) * 0.3))
        new_b = min(255, current[2] + int(147 * (1 - x/10) * 0.3))
        bg.putpixel((163-x, y), (new_r, current[1], new_b))

bg.save('build/bg.bmp')
print("Created bg.bmp")

# Create header.bmp (150x57) - Dark purple with pink line
header = Image.new('RGB', (150, 57), (32, 0, 40))
draw_header = ImageDraw.Draw(header)

# Draw glowing pink line
for y in range(25, 33):
    intensity = 1 - abs(y - 28) / 4
    color = (int(255 * intensity), int(20 * intensity), int(147 * intensity))
    draw_header.line([(0, y), (150, y)], fill=color)

header.save('build/header.bmp')
print("Created header.bmp")

# Create icon.ico - Pink water droplet
sizes = [16, 32, 48, 64, 128, 256]
icons = []

for size in sizes:
    icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)
    
    # Draw droplet shape
    center_x, center_y = size // 2, size // 2 + size // 8
    radius = size // 3
    
    # Main droplet body (circle)
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=(255, 20, 147, 255),  # Hot pink
        outline=(200, 0, 100, 255)
    )
    
    # Droplet top point (triangle approximation)
    top_y = center_y - radius - size // 6
    draw.polygon(
        [(center_x, top_y), (center_x - radius//3, center_y - radius), (center_x + radius//3, center_y - radius)],
        fill=(255, 20, 147, 255)
    )
    
    icons.append(icon)

# Save as ICO with multiple sizes
icons[0].save('build/icon.ico', format='ICO', sizes=[(s, s) for s in sizes], append_images=icons[1:])
print("Created icon.ico with sizes: " + str(sizes))

print("\nAll installer assets created successfully!")
