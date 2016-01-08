#!/usr/bin/env bash

gcc -v || ln -s $(which gcc-4.8) /usr/bin/gcc
gcc -v || exit 1

filename="mDNSResponder-561.1.1"

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
