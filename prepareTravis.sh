#!/usr/bin/env bash

gcc -v || ln -s $(which gcc-4.8) /usr/bin/gcc
gcc -v || exit 1

filename="mDNSResponder-561.1.1"
orientdb="orientdb-community-2.1.9"
wget "http://orientdb.com/download.php?email=unknown@unknown.com&file=${orientdb}.tar.gz&os=linux" -O ${orientdb}.tar.gz


tar xzf "${orientdb}.tar.gz"
cd ${orientdb}
sed -i"" -e 's/<users>/<users><user resources="*" password="happy" name="root"\/>/g' config/orientdb-server-config.xml
cat config/orientdb-server-config.xml
./bin/server.sh &
sleep 2
curl -X POST http://root:happy@localhost:2480/database/koala-puree-test-test/plocal
cd ..

wget "http://ftp.gnu.org/gnu/bison/bison-2.7.tar.gz"
tar xzf "bison-2.7.tar.gz"
cd bison-2.7
./configure && make && sudo make install

cd ../

wget "https://opensource.apple.com/tarballs/mDNSResponder/${filename}.tar.gz"
ln -s $(which gcc) /usr/bin/cc
tar xzf ${filename}.tar.gz
cd ${filename}
cd mDNSPosix
make os=linux
sudo make os=linux install

cd ../../

cd testApp
npm link ../
cd ../
