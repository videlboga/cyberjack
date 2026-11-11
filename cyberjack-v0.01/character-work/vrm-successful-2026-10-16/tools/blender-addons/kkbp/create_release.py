import urllib.request, shutil, os

def get(url, name):
    home_directory = os.path.expanduser("~")
    with urllib.request.urlopen(url) as response, open(os.path.join(home_directory, 'Downloads', name), 'wb') as out_file:
        shutil.copyfileobj(response, out_file)

if __name__ == '__main__':
    get('https://gitgoon.dev/kkbp-dev/KKBP_Importer/archive/master.zip', 'KKBP Importer 9.3.0.zip')
